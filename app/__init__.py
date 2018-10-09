from . import home, docs, inspector

from flask import Flask


application = Flask(__name__)
application.register_blueprint(home.bp)
application.register_blueprint(docs.bp, url_prefix='/docs')
application.register_blueprint(inspector.bp, url_prefix='/inspector')
