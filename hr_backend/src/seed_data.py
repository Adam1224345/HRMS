"""
Database seeding script to create initial admin user and sample data
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.models.user import db, User, Role, Permission

def seed_admin_user():
    """Create initial admin user"""
    # Check if admin user already exists
    admin_user = User.query.filter_by(username='admin').first()
    if admin_user:
        print("Admin user already exists")
        return
    
    # Get admin role
    admin_role = Role.query.filter_by(name='Admin').first()
    if not admin_role:
        print("Admin role not found. Please run the application first to initialize roles.")
        return
    
    # Create admin user
    admin_user = User(
        username='admin',
        email='admin@hrms.com',
        first_name='System',
        last_name='Administrator',
        is_active=True
    )
    admin_user.set_password('admin123')  # Change this in production
    admin_user.roles.append(admin_role)
    
    db.session.add(admin_user)
    db.session.commit()
    
    print("Admin user created successfully!")
    print("Username: admin")
    print("Password: admin123")
    print("Email: admin@hrms.com")

def seed_sample_users():
    """Create sample HR and Employee users"""
    # HR User
    hr_role = Role.query.filter_by(name='HR').first()
    if hr_role and not User.query.filter_by(username='hr_manager').first():
        hr_user = User(
            username='hr_manager',
            email='hr@hrms.com',
            first_name='HR',
            last_name='Manager',
            is_active=True
        )
        hr_user.set_password('hr123')
        hr_user.roles.append(hr_role)
        db.session.add(hr_user)
        print("HR Manager user created: hr_manager / hr123")
    
    # Employee User
    employee_role = Role.query.filter_by(name='Employee').first()
    if employee_role and not User.query.filter_by(username='john_doe').first():
        employee_user = User(
            username='john_doe',
            email='john.doe@hrms.com',
            first_name='John',
            last_name='Doe',
            is_active=True
        )
        employee_user.set_password('employee123')
        employee_user.roles.append(employee_role)
        db.session.add(employee_user)
        print("Employee user created: john_doe / employee123")
    
    db.session.commit()

if __name__ == '__main__':
    from src.main import app
    
    with app.app_context():
        seed_admin_user()
        seed_sample_users()
        print("\nDatabase seeding completed!")
        print("\nDefault users:")
        print("1. Admin: admin / admin123")
        print("2. HR Manager: hr_manager / hr123")
        print("3. Employee: john_doe / employee123")
