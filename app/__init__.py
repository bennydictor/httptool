from . import home, docs

from flask import Flask


application = Flask(__name__)
application.register_blueprint(home.bp)
application.register_blueprint(docs.bp, url_prefix='/docs')
