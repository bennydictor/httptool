import functools
import json
import os.path
import sys

from jsonschema import validate, ValidationError
from flask import request, abort, jsonify, make_response


def api(view=None, *, request_schema=None, response_schema=None):
    if view is None:
        return functools.partial(api, request_schema=request_schema, response_schema=response_schema)

    basedir = sys.modules[__package__].__path__[0]
    if isinstance(request_schema, str):
        request_schema = json.load(open(os.path.join(basedir, request_schema)))

    if isinstance(response_schema, str):
        response_schema = json.load(open(os.path.join(basedir, response_schema)))

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        if request.method == 'POST' and request.headers.get('Content-Type', None) != 'application/json':
            abort(415)

        for accept in request.headers.get_all('Accept'):
            if accept == 'application/json':
                break
        else:
            abort(406)

        if request_schema is not None:
            try:
                validate(request.get_json(), request_schema)
            except ValidationError:
                abort(400)

        rjson = view(*args, **kwargs)
        if isinstance(rjson, tuple):
            rjson, rcode = rjson
        else:
            rcode = 200


        if response_schema is not None:
            validate(rjson, response_schema)
            rjson['$schema'] = response_schema['$id']

        response = make_response(jsonify(rjson), rcode)
        response.headers['Content-Type'] = 'application/json'
        return response

    return wrapper
