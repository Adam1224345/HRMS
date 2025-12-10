import re

def validate_password_strength(password):
    """
    Validates the strength of a password based on a set of rules.
    Rules:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (@$!%*?&_)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one digit."
    
    # FIXED special character rule
    if not re.search(r"[@$!%*?&_]", password):
        return False, "Password must contain at least one special character (@$!%*?&_)"
    
    return True, ""
