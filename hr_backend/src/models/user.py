from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()

# Association table for many-to-many relationship between User and Role
user_roles = db.Table('user_roles',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('role.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

# Association table for many-to-many relationship between Role and Permission
role_permissions = db.Table('role_permissions',
    db.Column('role_id', db.Integer, db.ForeignKey('role.id'), primary_key=True),
    db.Column('permission_id', db.Integer, db.ForeignKey('permission.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Many-to-many relationship with Role
    roles = db.relationship('Role', secondary=user_roles, lazy='subquery',
                           backref=db.backref('users', lazy=True))

    def __repr__(self):
        return f'<User {self.username}>'

    def set_password(self, password):
        """Hash and set the user's password"""
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        """Check if the provided password matches the user's password"""
        return bcrypt.check_password_hash(self.password, password)

    def has_permission(self, permission_name):
        """Check if user has a specific permission through their roles"""
        for role in self.roles:
            for permission in role.permissions:
                if permission.name == permission_name:
                    return True
        return False

    def get_permissions(self):
        """Get all permissions for this user through their roles"""
        permissions = set()
        for role in self.roles:
            for permission in role.permissions:
                permissions.add(permission.name)
        return list(permissions)

    def to_dict(self, include_roles=False):
        user_dict = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_roles:
            user_dict['roles'] = [role.to_dict() for role in self.roles]
            user_dict['permissions'] = self.get_permissions()
        
        return user_dict

class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Many-to-many relationship with Permission
    permissions = db.relationship('Permission', secondary=role_permissions, lazy='subquery',
                                 backref=db.backref('roles', lazy=True))

    def __repr__(self):
        return f'<Role {self.name}>'

    def to_dict(self, include_permissions=False):
        role_dict = {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }
        
        if include_permissions:
            role_dict['permissions'] = [permission.to_dict() for permission in self.permissions]
        
        return role_dict

class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<Permission {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }
