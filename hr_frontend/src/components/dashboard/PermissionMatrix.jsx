

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { groupPermissionsByCategory, formatPermissionName } from '@/api/rolePermissions';

const PermissionMatrix = ({ 
  permissions = [], 
  selectedPermissionIds = [], 
  onPermissionChange = () => {},
  readOnly = false,
  compact = false
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [categorizedPermissions, setCategorizedPermissions] = useState({});

  useEffect(() => {
    // Group permissions by category
    const grouped = groupPermissionsByCategory(permissions);
    setCategorizedPermissions(grouped);
    
    // Expand all categories by default
    const expanded = {};
    Object.keys(grouped).forEach(category => {
      expanded[category] = true;
    });
    setExpandedCategories(expanded);
  }, [permissions]);

  /**
   * Toggle category expansion
   */
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  /**
   * Select all permissions in a category
   */
  const selectAllInCategory = (category) => {
    const categoryPermissions = categorizedPermissions[category];
    const categoryIds = categoryPermissions.map(p => p.id);
    const newIds = Array.from(new Set([...selectedPermissionIds, ...categoryIds]));
    onPermissionChange(newIds);
  };

  /**
   * Deselect all permissions in a category
   */
  const deselectAllInCategory = (category) => {
    const categoryPermissions = categorizedPermissions[category];
    const categoryIds = new Set(categoryPermissions.map(p => p.id));
    const newIds = selectedPermissionIds.filter(id => !categoryIds.has(id));
    onPermissionChange(newIds);
  };

  /**
   * Toggle a single permission
   */
  const togglePermission = (permissionId) => {
    if (selectedPermissionIds.includes(permissionId)) {
      onPermissionChange(selectedPermissionIds.filter(id => id !== permissionId));
    } else {
      onPermissionChange([...selectedPermissionIds, permissionId]);
    }
  };

  /**
   * Check if all permissions in a category are selected
   */
  const isCategoryFullySelected = (category) => {
    const categoryPermissions = categorizedPermissions[category];
    return categoryPermissions.every(p => selectedPermissionIds.includes(p.id));
  };

  /**
   * Check if some permissions in a category are selected
   */
  const isCategoryPartiallySelected = (category) => {
    const categoryPermissions = categorizedPermissions[category];
    const selectedCount = categoryPermissions.filter(p => selectedPermissionIds.includes(p.id)).length;
    return selectedCount > 0 && selectedCount < categoryPermissions.length;
  };

  if (Object.keys(categorizedPermissions).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No permissions available
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? 'max-h-96 overflow-y-auto border rounded-md p-4' : ''}`}>
      {Object.entries(categorizedPermissions).map(([category, categoryPermissions]) => {
        const isExpanded = expandedCategories[category];
        const isFullySelected = isCategoryFullySelected(category);
        const isPartiallySelected = isCategoryPartiallySelected(category);

        return (
          <div key={category} className="border rounded-lg overflow-hidden">
            {/* Category Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => toggleCategory(category)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  disabled={readOnly}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-sm capitalize text-gray-900">
                    {category} Permissions
                  </h3>
                  <p className="text-xs text-gray-600">
                    {selectedPermissionIds.filter(id => 
                      categoryPermissions.some(p => p.id === id)
                    ).length} of {categoryPermissions.length} selected
                  </p>
                </div>
              </div>

              {/* Select/Deselect All Buttons */}
              {!readOnly && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => selectAllInCategory(category)}
                    className="text-xs h-8"
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deselectAllInCategory(category)}
                    className="text-xs h-8"
                  >
                    None
                  </Button>
                </div>
              )}
            </div>

            {/* Category Permissions Grid */}
            {isExpanded && (
              <div className="p-4 bg-white border-t">
                <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3'}`}>
                  {categoryPermissions.map((permission) => {
                    const isSelected = selectedPermissionIds.includes(permission.id);
                    return (
                      <div
                        key={permission.id}
                        className={`flex items-start gap-2 p-2 rounded-md transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          id={`permission-${permission.id}`}
                          checked={isSelected}
                          onCheckedChange={() => togglePermission(permission.id)}
                          disabled={readOnly}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`permission-${permission.id}`}
                            className="text-sm font-medium text-gray-900 cursor-pointer"
                          >
                            {formatPermissionName(permission.name)}
                          </Label>
                          {permission.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionMatrix;
