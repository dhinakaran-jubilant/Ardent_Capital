import psycopg2
from psycopg2 import pool
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import time
import datetime
import jwt
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from utils.summary_generator import generate_branch_summary, generate_collection_efficiency

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super-secret-key-change-in-prod'
# Allowed Frontend Origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Add your production frontend domain here:
    # "https://your-frontend-domain.com"
]
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.get('role') != 'admin':
            return jsonify({'message': 'Admin privilege required!'}), 403
        return f(*args, **kwargs) # We consume current_user here, but don't strictly need to pass it unless the endpoint needs it. Actually, better not to pass it to avoid modifying all endpoint signatures unless needed.
    return decorated

# Database Configuration (PostgreSQL for ardent_db)
DB_HOST = "localhost"
DB_PORT = "5432"
DB_USER = "postgres"
DB_PASS = "Ardent@123" # User might need to change this if password auth fails
DB_NAME = "ardent_db"

# Create connection pool
connection_pool = None
try:
    # Attempt to connect to the specific database
    connection_pool = psycopg2.pool.SimpleConnectionPool(
        1, 20,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME
    )
except psycopg2.OperationalError as e:
    print(f"Initial connection to {DB_NAME} failed. Attempting to create it...")
    # If it fails, connect to default postgres db to create ardent_db
    try:
        conn = psycopg2.connect(
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT,
            database="postgres"
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE {DB_NAME};")
        conn.close()
        print(f"Database {DB_NAME} created successfully.")
        
        # Now initialize the pool with the new database
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1, 20,
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME
        )
    except Exception as creation_error:
        print(f"Failed to create database or connect: {creation_error}")

def init_db():
    if not connection_pool:
        print("No database connection pool available.")
        return
        
    conn = connection_pool.getconn()
    try:
        with conn.cursor() as cur:
            # Create users table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    employee_code VARCHAR(20) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    name VARCHAR(100),
                    role VARCHAR(20) DEFAULT 'user',
                    is_initial_password BOOLEAN DEFAULT TRUE,
                    security_question VARCHAR(255),
                    security_answer VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Alter table to add created_at if it was created before this change
            cur.execute("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            """)
            
            # Create upload_history table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS upload_history (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processing_time FLOAT NOT NULL,
                    lcc_filename VARCHAR(255) NOT NULL,
                    par_filename VARCHAR(255) NOT NULL
                )
            """)
            
            # Remove old admin
            cur.execute("DELETE FROM users WHERE employee_code = %s", ('JC0033',))
            
            # Check/seed default admin
            cur.execute("SELECT is_initial_password FROM users WHERE employee_code = %s", ('admin',))
            admin = cur.fetchone()
            
            if not admin:
                cur.execute("""
                    INSERT INTO users (employee_code, password, name, role, is_initial_password)
                    VALUES (%s, %s, %s, %s, %s)
                """, ('admin', generate_password_hash('Admin@123'), 'System Admin', 'admin', True))
                print("Seeded default admin user: admin / Admin@123")
            elif admin[0]:
                cur.execute("""
                    UPDATE users SET password = %s WHERE employee_code = %s
                """, (generate_password_hash('Admin@123'), 'admin'))
                print("Updated existing admin user password to: Admin@123")
                
            conn.commit()
    finally:
        connection_pool.putconn(conn)

with app.app_context():
    init_db()


@app.route('/upload', methods=['POST'])
@token_required
def upload_file(current_user):
    if 'lcc_file' not in request.files or 'par_file' not in request.files:
        return jsonify({"error": "Both LCC and PAR files are required"}), 400
        
    lcc_file = request.files['lcc_file']
    par_file = request.files['par_file']
    
    if lcc_file.filename == '' or par_file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if not (lcc_file.filename.endswith('.xlsx') or lcc_file.filename.endswith('.xls')) or \
       not (par_file.filename.endswith('.xlsx') or par_file.filename.endswith('.xls')):
        return jsonify({"error": "Only Excel files (.xlsx, .xls) are supported"}), 400
    
    username = request.form.get('username', 'System Admin').strip()
    start_time = time.time()

    try:
        excel_output = generate_branch_summary(lcc_file, par_file)
        processing_time = round(time.time() - start_time, 2)
        
        # Save to database history
        if connection_pool:
            conn = connection_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO upload_history (username, processing_time, lcc_filename, par_filename)
                        VALUES (%s, %s, %s, %s)
                    """, (username, processing_time, secure_filename(lcc_file.filename), secure_filename(par_file.filename)))
                    conn.commit()
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                connection_pool.putconn(conn)

        return send_file(
            excel_output,
            as_attachment=True,
            download_name="portfolio_cuts.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/upload/collection-efficiency', methods=['POST'])
@token_required
def upload_collection_efficiency(current_user):
    if 'lcc_file' not in request.files:
        return jsonify({"error": "LCC file is required"}), 400
        
    lcc_file = request.files['lcc_file']
    
    if lcc_file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if not (lcc_file.filename.endswith('.xlsx') or lcc_file.filename.endswith('.xls')):
        return jsonify({"error": "Only Excel files (.xlsx, .xls) are supported"}), 400
    
    username = request.form.get('username', 'System Admin').strip()
    start_time = time.time()

    try:
        excel_output = generate_collection_efficiency(lcc_file)
        processing_time = round(time.time() - start_time, 2)
        
        # Save to database history
        if connection_pool:
            conn = connection_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO upload_history (username, processing_time, lcc_filename, par_filename)
                        VALUES (%s, %s, %s, %s)
                    """, (username, processing_time, secure_filename(lcc_file.filename), 'N/A'))
                    conn.commit()
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                connection_pool.putconn(conn)

        return send_file(
            excel_output,
            as_attachment=True,
            download_name="collection_efficiency.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Authentication Routes ---

@app.route('/api/login/', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    try:
        data = request.json
        emp_code = data.get('employee_code', '').strip()
        password = data.get('password', '')
        
        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        user = None
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT employee_code, password, name, role, is_initial_password 
                    FROM users 
                    WHERE LOWER(employee_code) = LOWER(%s)
                """, (emp_code,))
                user = cur.fetchone()
        finally:
            connection_pool.putconn(conn)

        if user:
            u_emp_code, u_password, u_name, u_role, u_is_initial = user
            if check_password_hash(u_password, password):
                token = jwt.encode({
                    'employee_code': u_emp_code,
                    'name': u_name,
                    'role': u_role,
                    'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
                }, app.config['SECRET_KEY'], algorithm="HS256")

                return jsonify({
                    'success': True,
                    'token': token,
                    'user': {
                        'employee_code': u_emp_code,
                        'name': u_name,
                        'role': u_role,
                        'is_initial_password': u_is_initial
                    }
                })
            else:
                print("Password mismatch")
        else:
            print("User not found in DB")
            
        return jsonify({'success': False, 'message': 'Invalid employee code or password'}), 401
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users/initial-setup/', methods=['POST'])
@token_required
def initial_setup(current_user):
    try:
        data = request.json
        emp_code = data.get('employee_code')
        new_password = data.get('new_password')
        question = data.get('q1')
        answer = data.get('a1')
        
        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE LOWER(employee_code) = LOWER(%s)", (emp_code,))
                user = cur.fetchone()
                
                if not user:
                    return jsonify({'success': False, 'message': 'User not found'}), 404
                    
                cur.execute("""
                    UPDATE users 
                    SET password = %s, is_initial_password = %s, security_question = %s, security_answer = %s
                    WHERE LOWER(employee_code) = LOWER(%s)
                """, (
                    generate_password_hash(new_password), 
                    False, 
                    question, 
                    generate_password_hash(answer.lower().strip()),
                    emp_code
                ))
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            connection_pool.putconn(conn)
            
        return jsonify({'success': True, 'message': 'Setup completed successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/forgot-password/request/', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password_request():
    try:
        data = request.json
        emp_code = data.get('employee_code')
        
        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT security_question, role 
                    FROM users 
                    WHERE LOWER(employee_code) = LOWER(%s)
                """, (emp_code,))
                user = cur.fetchone()
        finally:
            connection_pool.putconn(conn)

        if user and user[0]:
            return jsonify({'success': True, 'question': user[0], 'role': user[1]})
        return jsonify({'success': False, 'message': 'User not found or security questions not set'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/forgot-password/reset/', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password_reset():
    try:
        data = request.json
        emp_code = data.get('employee_code')
        answer = data.get('answer', '').lower().strip()
        new_password = data.get('new_password')
        
        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT security_answer 
                    FROM users 
                    WHERE LOWER(employee_code) = LOWER(%s)
                """, (emp_code,))
                user = cur.fetchone()
                
                if user and user[0] and check_password_hash(user[0], answer):
                    cur.execute("""
                        UPDATE users SET password = %s WHERE LOWER(employee_code) = LOWER(%s)
                    """, (generate_password_hash(new_password), emp_code))
                    conn.commit()
                    return jsonify({'success': True, 'message': 'Password reset successful'})
                return jsonify({'success': False, 'message': 'Incorrect answer or user not found'}), 401
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            connection_pool.putconn(conn)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# --- User Management API Routes ---

@app.route('/api/users/', methods=['GET'])
@token_required
@admin_required
def get_users():
    try:
        if not connection_pool:
            return jsonify({'error': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, employee_code, name, role, is_initial_password, created_at FROM users ORDER BY created_at ASC")
                users = cur.fetchall()
        finally:
            connection_pool.putconn(conn)

        user_list = []
        for u in users:
            user_list.append({
                'id': u[0],
                'employee_code': u[1],
                'name': u[2],
                'role': u[3],
                'is_initial_password': u[4],
                'created_at': u[5].strftime('%Y-%m-%dT%H:%M:%SZ') if u[5] else None
            })
        return jsonify(user_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/', methods=['POST'])
@token_required
@admin_required
def create_user():
    try:
        data = request.json
        emp_code = data.get('employee_code', '').strip()
        name = data.get('name', '').strip()
        role = data.get('role', 'user').strip()
        password = data.get('password', 'Admin@123')

        if not emp_code or not name:
            return jsonify({'success': False, 'message': 'Employee code and name are required'}), 400

        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE LOWER(employee_code) = LOWER(%s)", (emp_code,))
                existing_user = cur.fetchone()
                
                if existing_user:
                    return jsonify({'success': False, 'message': 'User with this employee code already exists'}), 400

                cur.execute("""
                    INSERT INTO users (employee_code, name, role, password, is_initial_password)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                """, (emp_code, name, role, generate_password_hash(password), True))
                new_id = cur.fetchone()[0]
                conn.commit()
                
                return jsonify({'success': True, 'message': 'User created successfully', 'user_id': new_id}), 201
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            connection_pool.putconn(conn)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
@admin_required
def update_user(user_id):
    try:
        data = request.json
        name = data.get('name', '').strip()
        role = data.get('role', '').strip()
        password = data.get('password', '').strip()

        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
                if not cur.fetchone():
                    return jsonify({'success': False, 'message': 'User not found'}), 404

                updates = []
                values = []
                if name:
                    updates.append("name = %s")
                    values.append(name)
                if role:
                    updates.append("role = %s")
                    values.append(role)
                if password:
                    updates.append("password = %s")
                    values.append(generate_password_hash(password))
                    updates.append("is_initial_password = %s")
                    values.append(True)
                
                if updates:
                    values.append(user_id)
                    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
                    cur.execute(query, tuple(values))
                    conn.commit()
                    
                return jsonify({'success': True, 'message': 'User updated successfully'}), 200
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            connection_pool.putconn(conn)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(user_id):
    try:
        if not connection_pool:
            return jsonify({'success': False, 'message': 'Database connection error'}), 500

        conn = connection_pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
                if not cur.fetchone():
                    return jsonify({'success': False, 'message': 'User not found'}), 404

                cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
                conn.commit()
                
                return jsonify({'success': True, 'message': 'User deleted successfully'}), 200
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            connection_pool.putconn(conn)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=4003, ssl_context=('cert.pem', 'key.pem'))
