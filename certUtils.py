import re
import requests
import json
from OpenSSL import crypto

# this is a script with utility functions related to certificate files creation
# and EJBCA-REST requests


# the following functions are related to file manipulation
# these functions  may throw crypto.Error

def saveCRL(filename, rawCRL):
    crl = ("-----BEGIN X509 CRL-----\n"
            + '\n'.join(rawCRL[i:i+64] for i in range(0, len(rawCRL), 64)) #X509 -each line have 64 bytes
            + "\n-----END X509 CRL-----\n")
    crypto.load_crl(crypto.FILETYPE_PEM, crl)

    with open(filename, "w") as crlFile:
        crlFile.write(crl)


def saveCRT(filename, rawCRT):
    crt = ("-----BEGIN CERTIFICATE-----\n"
           + rawCRT
           + "\n-----END CERTIFICATE-----\n")

    with open(filename, "w") as crtFile:
        crtFile.write(crt)


def generateCSR(CName, privateKeyFile, csrFileName, dnsname=None, ipaddr=None):
    # based on https://github.com/cjcotton/python-csr

    if dnsname is None:
        dnsname = []

    if ipaddr is None:
        ipaddr = []

    ss = []
    for i in dnsname:
        ss.append("DNS: %s" % i)
    for i in ipaddr:
        ss.append("IP: %s" % i)
    ss = ", ".join(ss)

    req = crypto.X509Req()
    req.get_subject().CN = CName

    # Add in extensions
    base_constraints = ([
        crypto.X509Extension(
                    b"keyUsage",
                    False,
                    b"Digital Signature, Non Repudiation, Key Encipherment"),
        crypto.X509Extension(b"basicConstraints", False, b"CA:FALSE"),
    ])
    x509_extensions = base_constraints

    if ss:
        san_constraint = crypto.X509Extension(b"subjectAltName", False, ss.encode("utf-8"))
        x509_extensions.append(san_constraint)

    req.add_extensions(x509_extensions)

    with open(privateKeyFile) as keyfile:
        key = crypto.load_privatekey(crypto.FILETYPE_PEM, keyfile.read())

    req.set_pubkey(key)
    req.sign(key, "sha256")

    with open(csrFileName, "w") as csrFile:
        csrFile.write(
            crypto.dump_certificate_request(crypto.FILETYPE_PEM, req).decode("utf-8"))


def generatePrivateKey(keyFile, bitLen):
    key = crypto.PKey()
    key.generate_key(crypto.TYPE_RSA, bitLen)
    key_file = None
    with open(keyFile, "w") as key_file:
        key_file.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, key).decode("utf-8"))


# default header for HTTP requests
defaultHeader = {'content-type': 'application/json',
                 'Accept': 'application/json'}


# the following functions are related to EJBCA-REST requests
# they may throw requests.exceptions.ConnectionError,
# KeyError or the custom EJBCARESTException

class EJBCARESTException(Exception):
    pass


def retrieveCAChain(EJBCA_API_URL, CAName):
    response = requests.get(EJBCA_API_URL + '/ca/' + CAName,
                            headers=defaultHeader)
    return json.loads(response.content)['certificate']


def retrieveCACRL(EJBCA_API_URL, CAName):
    response = requests.get(EJBCA_API_URL + '/ca/' + CAName + "/crl",
                            headers=defaultHeader, params={'update': 'true'})
    return json.loads(response.content)['CRL']


def createEJBCAUser(EJBCA_API_URL, CAName, CName, passwd,
                    certificateProfileName="CFREE",
                    endEntityProfileName="EMPTY_CFREE"):

    # create the ejbca user
    req = json.dumps({
        "caName": CAName,
        "certificateProfileName": certificateProfileName,
        "clearPwd": True,
        "endEntityProfileName": endEntityProfileName,
        "keyRecoverable": False,
        "password": passwd.decode("utf-8"),
        "sendNotification": False,
        "status": 10,
        "subjectDN": "CN=" + CName,
        "tokenType": "USERGENERATED",
        "username": CName
    })

    response = requests.post(EJBCA_API_URL + "/user",
                             headers=defaultHeader,
                             data=req)

    if response.status_code != 200:
        raise EJBCARESTException(str(response.content))


def signCert(EJBCA_API_URL, csrFile, CName, passwd):
    csr_file = None
    with open(csrFile, "r") as csr_file:
        csr = csr_file.read()
    cutDownCLR = (csr[csr.find('-----BEGIN CERTIFICATE REQUEST-----')
                  + len('-----BEGIN CERTIFICATE REQUEST-----'):
                  csr.find("-----END CERTIFICATE REQUEST-----")]
                  .replace("\n", ""))

    req = json.dumps({
        "passwd": passwd.decode("utf-8"),
        "certificate": cutDownCLR
    })

    response = requests.post(EJBCA_API_URL + "/sign/" + CName + "/pkcs10",
                             headers=defaultHeader, data=req)

    if response.status_code == 200:
        return json.loads(response.content)['status']['data']
    else:
        raise EJBCARESTException(str(response.content))
