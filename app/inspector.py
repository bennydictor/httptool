import socket
import re
import codecs

from .api_json import api

from flask import current_app, Blueprint, request, render_template


bp = Blueprint('inspector', __name__)

@bp.route('/')
def index():
    return render_template('inspector.html')

@bp.route('/request-schema.json')
def request_schema():
    return current_app.send_static_file('inspector-request-schema.json')

@bp.route('/response-schema.json')
def response_schema():
    return current_app.send_static_file('inspector-response-schema.json')

@bp.route('/api', methods=('POST',))
@api(request_schema='static/inspector-request-schema.json', response_schema='static/inspector-response-schema.json')
def api():
    rq = request.json
    errors = []

    if rq['scheme'] not in ('http', 'https'):
        errors.append({'error': 'Invalid scheme'})

    if not (0 <= rq['port'] < 2 ** 16):
        errors.append({'error': 'Invalid port'})

    if not re.match(r'^[A-Z]+$', rq['method']):
        errors.append({'error': 'Invalid method'})
    method = rq['method'].encode()

    if not re.match(r'^([!*\'();:@&=+$,/?#[\]A-Za-z0-9_.~-]|%[0-9A-F]{2})+$', rq['path']):
        errors.append({'error': 'Invalid path'})
    path = rq['path'].encode()

    headers = []
    for i, header in enumerate(rq['headers']):
        if not re.match(r'^[A-Za-z-]+$', header['header']):
            errors.append({'error': 'Invalid header', 'header': header['header'], 'index': i})
        hv = header['value'].encode()
        if not all(0x20 <= x < 0x7f or 0x80 <= x for x in hv):
            errors.append({'error': 'Invalid header value', 'value': header['value'], 'index': i})
        headers.append((header['header'].encode(), hv))

    if rq['body']['encoding'] not in ('utf-8', 'base64'):
        errors.append({'error': 'Invalid encoding'})
    else:
        body = rq['body']['data'].encode()
        if rq['body']['encoding'] == 'base64':
            try:
                body = codecs.decode(body, 'base64')
            except ValueError:
                errors.append({'error': 'Invalid body'})

    if len(errors) > 0:
        return {'status': 'error', 'errors': errors}, 403


    if not (rq['scheme'] == 'http' and rq['host'] == 'example.com' and rq['port'] == 80):
        return {'status': 'error', 'errors': [{'error': 'We currently only allow requests to http://example.com:80'}]}, 501

    try:
        gai_family, gai_type, gai_proto, _, gai_sockaddr = socket.getaddrinfo(rq['host'], rq['port'], socket.AF_INET, socket.SOCK_STREAM)[0]
    except (socket.gaierror, IndexError):
        return {'status': 'error', 'errors': [{'error': 'Host lookup failed'}]}, 403

    sock = socket.socket(gai_family, gai_type, gai_proto)
    sock.settimeout(10)
    try:
        sock.connect(gai_sockaddr)
        sock.send(method + b' ' + path + b' HTTP/1.1\r\n')
        for h in headers:
            sock.send(h[0] + b': ' + h[1] + b'\r\n')
        sock.send(b'\r\n')
        sock.send(body)

        resp = sock.recv(1 << 20)
    except socket.timeout:
        return {'status': 'error', 'errors': [{'error': 'Request timed out'}]}

    try:
        if resp.find(b'\r\n') == -1:
            raise ValueError
        tok, _, resp = resp.partition(b'\r\n')
        httph, code, *line = tok.split(b' ')
        line = b' '.join(line)
        code, line = int(code.decode()), line.decode()
        http_str, http_ver = httph.split(b'/')
        if http_str != b'HTTP':
            raise ValueError
        if http_ver not in (b'1.0', b'1.1'):
            try:
                http_ver = http_ver.decode()
                return {'status': 'error', 'errors': [{'error': 'HTTP version not supported', 'version': http_ver}]}
            except UnicodeDecodeError:
                return {'status': 'error', 'errors': [{'error': 'HTTP version not supported'}]}

        headers = []
        while True:
            if resp.find(b'\r\n') == -1:
                raise ValueError
            tok, _, resp = resp.partition(b'\r\n')
            if tok == b'':
                break
            if tok.find(b': ') == -1:
                raise ValueError
            header, _, value = tok.partition(b': ')
            headers.append({'header': header.decode(), 'value': value.decode()})
    except (ValueError, UnicodeDecodeError):
        return {'status': 'error', 'errors': [{'error': 'Invalid response from server'}]}

    try:
        resp = resp.decode()
        resp_enc = 'utf-8'
    except UnicodeDecodeError:
        resp = codecs.encode(resp, 'base64').decode()
        resp_enc = 'base64'

    return {
        'status': 'ok',
        'status_code': code,
        'status_line': line,
        'headers': headers,
        'body': {
            'encoding': resp_enc,
            'data': resp,
        },
    }
