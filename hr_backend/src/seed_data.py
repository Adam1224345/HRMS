import os
import sys
from datetime import datetime, timedelta, date

PROJECT_ROOT = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, PROJECT_ROOT)

from src.models.user import db, bcrypt, User, Role, Permission
from src.models.task import Task
from src.models.leave import Leave

from flask import Flask

def create_seeder_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = (
    "postgresql+psycopg2://neondb_owner:npg_giUZDNp0W1wb@"
    "ep-square-recipe-a1w5e43j.ap-southeast-1.aws.neon.tech/neondb"
    "?sslmode=require&channel_binding=require"
)
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    bcrypt.init_app(app)
    return app

def init_roles_and_permissions():
    print("Creating roles and permissions...")
    permissions = [
        ('user_read', 'Read user info'), ('user_write', 'Create/update users'), ('user_delete', 'Delete users'),
        ('role_read', 'Read roles'), ('role_write', 'Create/update roles'), ('role_delete', 'Delete roles'),
        ('permission_read', 'Read permissions'), ('permission_write', 'Create/update permissions'), ('permission_delete', 'Delete permissions'),
        ('task_read', 'Read tasks'), ('task_write', 'Create/update tasks'), ('task_delete', 'Delete tasks'),
        ('leave_read', 'Read leaves'), ('leave_write', 'Create/update leaves'), ('leave_delete', 'Delete leaves'),
        ('leave_approve', 'Approve/reject leaves'),
    ]
    for name, desc in permissions:
        if not Permission.query.filter_by(name=name).first():
            db.session.add(Permission(name=name, description=desc))

    roles = [('Admin', 'Full access'), ('HR', 'HR manager'), ('Employee', 'Regular employee')]
    for name, desc in roles:
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=desc))

    db.session.commit()

    admin = Role.query.filter_by(name='Admin').first()
    hr = Role.query.filter_by(name='HR').first()
    emp = Role.query.filter_by(name='Employee').first()

    if admin:
        admin.permissions = Permission.query.all()
    if hr:
        hr.permissions = Permission.query.filter(Permission.name.in_([
            'user_read', 'user_write', 'role_read',
            'task_read', 'task_write', 'task_delete',
            'leave_read', 'leave_write', 'leave_approve'
        ])).all()
    if emp:
        emp.permissions = Permission.query.filter(Permission.name.in_([
            'user_read', 'task_read', 'leave_read', 'leave_write'
        ])).all()

    db.session.commit()
    print("Roles & permissions created.")


def seed_admin():
    if User.query.filter_by(username='admin').first():
        print("Admin already exists.")
        return
    role = Role.query.filter_by(name='Admin').first()
    user = User(username='admin', email='admin@hrms.com', first_name='System', last_name='Admin', is_active=True)
    user.set_password('admin123')
    user.roles.append(role)
    db.session.add(user)
    db.session.commit()
    print("Admin created → admin / admin123")


def seed_sample_users():
    hr_role = Role.query.filter_by(name='HR').first()
    emp_role = Role.query.filter_by(name='Employee').first()

    if hr_role and not User.query.filter_by(username='hr_manager').first():
        u = User(username='hr_manager', email='hr@hrms.com', first_name='HR', last_name='Manager', is_active=True)
        u.set_password('hr123')
        u.roles.append(hr_role)
        db.session.add(u)
        print("HR created → hr_manager / hr123")

    if emp_role and not User.query.filter_by(username='john_doe').first():
        u = User(username='john_doe', email='john.doe@hrms.com', first_name='John', last_name='Doe', is_active=True)
        u.set_password('employee123')
        u.roles.append(emp_role)
        db.session.add(u)
        print("Employee created → john_doe / employee123")

    db.session.commit()


def seed_tasks_and_leaves():
    admin = User.query.filter_by(username='admin').first()
    hr = User.query.filter_by(username='hr_manager').first()
    emp = User.query.filter_by(username='john_doe').first()

    if not all([admin, hr, emp]):
        print("Users missing. Skipping tasks/leaves.")
        return

    tasks = [
        ('Review Q3 Reports', 'Completed', 'High', hr, admin, datetime.now() - timedelta(days=10)),
        ('Update Handbook', 'In Progress', 'Medium', hr, admin, datetime.now() + timedelta(days=20)),
        ('Setup Onboarding', 'Pending', 'High', emp, admin, datetime.now() + timedelta(days=5)),
        ('Security Training', 'Completed', 'Low', emp, hr, datetime.now() - timedelta(days=5)),
        ('Expense Report', 'In Progress', 'Medium', emp, hr, datetime.now() + timedelta(days=3)),
    ]
    for title, status, prio, to_user, by_user, due in tasks:
        if not Task.query.filter_by(title=title).first():
            db.session.add(Task(
                title=title, description=f"Description for {title}",
                status=status, priority=prio, due_date=due,
                assigned_to_id=to_user.id, assigned_by_id=by_user.id
            ))

    leaves = [
        ('Vacation', date.today()-timedelta(15), date.today()-timedelta(10), 'Approved', emp, hr),
        ('Sick Leave', date.today()+timedelta(1), date.today()+timedelta(3), 'Pending', emp, None),
        ('Casual Leave', date.today()+timedelta(20), date.today()+timedelta(21), 'Rejected', hr, admin),
    ]
    for typ, s, e, st, user, rev in leaves:
        if not Leave.query.filter_by(leave_type=typ, user_id=user.id, start_date=s).first():
            db.session.add(Leave(
                leave_type=typ, start_date=s, end_date=e,
                reason=f"Reason for {typ}", status=st,
                user_id=user.id, reviewed_by_id=rev.id if rev else None
            ))

    db.session.commit()
    print("Sample tasks & leaves added.")

if __name__ == '__main__':
    app = create_seeder_app()
    with app.app_context():
        if Role.query.first():
            print("Database already seeded. Nothing to do.")
        else:
            print("Seeding database...")
            init_roles_and_permissions()
            seed_admin()
            seed_sample_users()
            seed_tasks_and_leaves()
            print("\nSeeding complete!")
            print("Login with:")
            print("  admin        → admin123")
            print("  hr_manager   → hr123")
            print("  john_doe     → employee123")
            print("\nStart server: python main.py")