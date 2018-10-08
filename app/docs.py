from flask import Blueprint, render_template


bp = Blueprint('docs', __name__)

@bp.route('/')
def index():
    return render_template('docs.html')
