const isDevelopment = process.env.NODE_ENV === 'development';

const API_BASE = isDevelopment ? 'http://localhost:5000/api' : '/api';

const token = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token()}`
});

export const fetchRoles = async () => {
  try {
    const response = await fetch(`${API_BASE}/roles`, {
      headers: headers()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch roles: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
};

export const fetchRoleById = async (roleId) => {
  try {
    const response = await fetch(`${API_BASE}/roles/${roleId}`, {
      headers: headers()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch role: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching role:', error);
    throw error;
  }
};

/**
 * Create a new role with permissions
 * @param {Object} roleData - { name, description, permission_ids }
 */
export const createRole = async (roleData) => {
  try {
    const response = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(roleData)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create role: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
};

/**
 * Update an existing role and its permissions
 * @param {number} roleId - The role ID to update
 * @param {Object} roleData - { name, description, permission_ids }
 */
export const updateRole = async (roleId, roleData) => {
  try {
    const response = await fetch(`${API_BASE}/roles/${roleId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(roleData)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update role: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};

/**
 * Delete a role
 * @param {number} roleId - The role ID to delete
 */
export const deleteRole = async (roleId) => {
  try {
    const response = await fetch(`${API_BASE}/roles/${roleId}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete role: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
};

// ==================== PERMISSIONS ====================

/**
 * Fetch all available permissions
 */
export const fetchPermissions = async () => {
  try {
    const response = await fetch(`${API_BASE}/permissions`, {
      headers: headers()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch permissions: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw error;
  }
};

/**
 * Group permissions by category (e.g., user, role, permission, task, leave)
 * @param {Array} permissions - Array of permission objects
 * @returns {Object} Grouped permissions by category
 */
export const groupPermissionsByCategory = (permissions) => {
  const categories = {};

  permissions.forEach(permission => {
    const category = permission.name.split('_')[0];
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(permission);
  });

  return categories;
};

/**
 * Format permission name for display (e.g., 'user_read' -> 'User Read')
 * @param {string} permissionName - The permission name
 * @returns {string} Formatted permission name
 */
export const formatPermissionName = (permissionName) => {
  return permissionName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};