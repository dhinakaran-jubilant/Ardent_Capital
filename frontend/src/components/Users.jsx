import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from './config';

function Users({ user: currentUser, onLogout }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, users]);

    // Add User Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEmpCode, setNewEmpCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('user');
    const [newPassword, setNewPassword] = useState('123456'); // Default password
    const [adding, setAdding] = useState(false);

    // Delete User Confirmation State
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Edit User Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('user');
    const [editPassword, setEditPassword] = useState('');
    const [updating, setUpdating] = useState(false);

    const [successMessage, setSuccessMessage] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${config.API_BASE_URL}/api/users/`);
            setUsers(response.data);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to fetch user accounts. Please check your backend connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAdding(true);
        setError(null);
        setSuccessMessage('');

        try {
            const response = await axios.post(`${config.API_BASE_URL}/api/users/`, {
                employee_code: newEmpCode.trim(),
                name: newName.trim(),
                role: newRole,
                password: newPassword
            });

            if (response.data.success) {
                setSuccessMessage('User account added successfully!');
                setShowAddModal(false);
                setNewEmpCode('');
                setNewName('');
                setNewRole('user');
                setNewPassword('Admin@123');
                fetchUsers();

                // Auto-clear success message
                setTimeout(() => setSuccessMessage(''), 5000);
            } else {
                setError(response.data.message || 'Failed to add user.');
            }
        } catch (err) {
            console.error('Error adding user:', err);
            setError(err.response?.data?.message || 'Error occurred while saving new user account.');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        setError(null);
        setSuccessMessage('');

        try {
            const response = await axios.delete(`${config.API_BASE_URL}/api/users/${userToDelete.id}`);
            if (response.data.success) {
                setSuccessMessage(`Successfully deleted account for ${userToDelete.name}`);
                setUserToDelete(null);
                fetchUsers();
                
                // Auto-clear success message
                setTimeout(() => setSuccessMessage(''), 5000);
            } else {
                setError(response.data.message || 'Failed to delete user.');
            }
        } catch (err) {
            console.error('Error deleting user:', err);
            setError(err.response?.data?.message || 'Failed to remove user account.');
        } finally {
            setDeleting(false);
        }
    };

    const handleEditClick = (u) => {
        setUserToEdit(u);
        setEditName(u.name || '');
        setEditRole(u.role || 'user');
        setEditPassword('');
        setShowEditModal(true);
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setError(null);
        setSuccessMessage('');

        try {
            const response = await axios.put(`${config.API_BASE_URL}/api/users/${userToEdit.id}`, {
                name: editName.trim(),
                role: editRole,
                password: editPassword.trim() || undefined
            });

            if (response.data.success) {
                setSuccessMessage('User profile updated successfully!');
                setShowEditModal(false);
                setUserToEdit(null);
                setEditName('');
                setEditRole('user');
                setEditPassword('');
                fetchUsers();

                // Auto-clear success message
                setTimeout(() => setSuccessMessage(''), 5000);
            } else {
                setError(response.data.message || 'Failed to update user.');
            }
        } catch (err) {
            console.error('Error updating user:', err);
            setError(err.response?.data?.message || 'Error occurred while saving updated user details.');
        } finally {
            setUpdating(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.employee_code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#101822] px-10 py-8 transition-colors duration-300 h-full overflow-hidden">
            {/* Header + Toolbar in one row */}
            <div className="flex items-stretch gap-3 mb-8">
                {/* Search bar — grows to fill all available space */}
                <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500 pointer-events-none">
                        <span className="material-symbols-outlined text-lg">search</span>
                    </span>
                    <input
                        type="text"
                        placeholder="Search users by name or employee code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-[50%] h-12 pl-11 pr-10 bg-white dark:bg-[#0f172b] border border-slate-200 dark:border-slate-800/80 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-md">close</span>
                        </button>
                    )}
                </div>

                {/* Add New User button — same height as search bar, no shadow */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 h-12 px-6 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Add New User
                </button>
            </div>


            {/* Notifications & Status Banner */}
            {successMessage && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-6 py-4 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                    <span className="text-[12px] font-bold tracking-widest uppercase">{successMessage}</span>
                    <button
                        onClick={() => setSuccessMessage('')}
                        className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg hover:bg-emerald-500/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>
            )}

            {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-4 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <span className="material-symbols-outlined text-2xl">error_outline</span>
                    <span className="text-[12px] font-bold tracking-widest uppercase">{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col min-h-0 rounded-3xl bg-white dark:bg-[#0f172b] shadow-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden">
                {/* Fixed column header — outside scroll container so scrollbar only appears in the body below */}
                <div className="shrink-0 bg-slate-50/90 dark:bg-[#111926]/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800/80">
                    <table className="w-full border-collapse text-left table-fixed">
                        <colgroup>
                            <col style={{width:'8%'}} />
                            <col style={{width:'26%'}} />
                            <col style={{width:'20%'}} />
                            <col style={{width:'12%'}} />
                            <col style={{width:'22%'}} />
                            <col style={{width:'12%'}} />
                        </colgroup>
                        <thead>
                            <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="py-5 px-8">S.No</th>
                                <th className="py-5 px-6">Staff Member</th>
                                <th className="py-5 px-6">Employee Code</th>
                                <th className="py-5 px-6">Role</th>
                                <th className="py-5 px-6">Setup Status</th>
                                <th className="py-5 px-8 text-right">Actions</th>
                            </tr>
                        </thead>
                    </table>
                </div>

                {/* Scrollable body — scrollbar track starts here, below the header */}
                <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-slim">
                    <table className="w-full border-collapse text-left table-fixed">
                        <colgroup>
                            <col style={{width:'8%'}} />
                            <col style={{width:'26%'}} />
                            <col style={{width:'20%'}} />
                            <col style={{width:'12%'}} />
                            <col style={{width:'22%'}} />
                            <col style={{width:'12%'}} />
                        </colgroup>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Loading user profiles...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">group_off</span>
                                            <span className="text-[11px] font-black uppercase tracking-[0.2em]">No matching users found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((u, idx) => {
                                    const isSelf = currentUser?.employee_code === u.employee_code;
                                    const initials = u.name ? u.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'JD';
                                    const serialNumber = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                                    
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-[#111926]/20 transition-colors group">
                                            <td className="py-3 px-8 text-slate-400 font-mono font-bold">
                                                {serialNumber}
                                            </td>
                                            <td className="py-3 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                                                            {u.name || 'Unnamed Staff'}
                                                            {isSelf && (
                                                                <span className="px-2 py-0.5 bg-blue-600/15 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-widest rounded-md">
                                                                    You
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-6">
                                                <span className="font-mono font-bold tracking-wider uppercase text-slate-800 dark:text-slate-200">
                                                    {u.employee_code}
                                                </span>
                                            </td>
                                            <td className="py-3 px-6">
                                                <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                                                    u.role === 'admin' 
                                                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                                                        : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {u.role === 'admin' ? 'Admin' : 'User'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${!u.is_initial_password ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                        {!u.is_initial_password ? 'Setup Complete' : 'Pending Initial Login'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-8 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleEditClick(u)}
                                                        className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all cursor-pointer"
                                                        title="Edit User Details"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    {!isSelf ? (
                                                        <button
                                                            onClick={() => setUserToDelete(u)}
                                                            className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer"
                                                            title="Delete User Account"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled
                                                            className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40"
                                                            title="Cannot delete your own active account"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>


            {/* Pagination Controls */}
                {filteredUsers.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-8 bg-slate-50/50 dark:bg-[#111926]/40 border-t border-slate-200 dark:border-slate-800/60 rounded-b-3xl">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                            Showing <span className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}</span> of <span className="text-slate-800 dark:text-slate-200">{filteredUsers.length}</span> records
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-[#0f172b]/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1 || totalPages <= 1}
                                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer ${
                                    (currentPage === 1 || totalPages <= 1)
                                        ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-55'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 active:scale-90'
                                }`}
                                title="Previous Page"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_left</span>
                            </button>
                            
                            {totalPages > 1 && (() => {
                                const pages = [];
                                const maxVisible = 5;
                                if (totalPages <= maxVisible) {
                                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                                } else {
                                    pages.push(1);
                                    const start = Math.max(2, currentPage - 1);
                                    const end = Math.min(totalPages - 1, currentPage + 1);
                                    if (start > 2) {
                                        pages.push('ellipsis-1');
                                    }
                                    for (let i = start; i <= end; i++) {
                                        pages.push(i);
                                    }
                                    if (end < totalPages - 1) {
                                        pages.push('ellipsis-2');
                                    }
                                    pages.push(totalPages);
                                }
                                
                                return pages.map((page, idx) => {
                                    if (typeof page === 'string') {
                                        return (
                                            <span 
                                                key={`ellipsis-${idx}`} 
                                                className="w-10 h-10 flex items-center justify-center font-bold text-xs text-slate-400 dark:text-slate-500"
                                            >
                                                ...
                                            </span>
                                        );
                                    }
                                    
                                    const isCurrent = page === currentPage;
                                    return (
                                        <button
                                            type="button"
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-10 h-10 flex items-center justify-center font-bold text-xs rounded-xl transition-all cursor-pointer ${
                                                isCurrent
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                });
                            })()}

                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages <= 1}
                                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer ${
                                    (currentPage === totalPages || totalPages <= 1)
                                        ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-55'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 active:scale-90'
                                }`}
                                title="Next Page"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <form 
                        onSubmit={handleAddUser}
                        className="bg-white dark:bg-[#0a0f18] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 p-8 flex flex-col animate-in zoom-in-95 duration-200"
                    >
                        <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Add New User</h3>
                        
                        <div className="flex flex-col gap-6 mb-8">
                            {/* Row 1: Full Name */}
                            <div className="flex flex-col gap-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter full name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px]"
                                />
                            </div>

                            {/* Row 2: Employee Code & Security Role */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Employee Code</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. JB1045"
                                        value={newEmpCode}
                                        onChange={(e) => setNewEmpCode(e.target.value)}
                                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 uppercase dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-[13px]"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Security Role</label>
                                    <div className="relative">
                                        <select
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value)}
                                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer font-bold text-[13px]"
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            keyboard_arrow_down
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Temporary Password */}
                            <div className="flex flex-col gap-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Temporary Password</label>
                                <input
                                    type="text"
                                    placeholder="Enter temporary password (defaults to Admin@123)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px]"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-6 py-4 rounded-xl border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-[11px] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={adding}
                                className="flex-1 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[11px] transition-all cursor-pointer shadow-xl shadow-blue-600/20 disabled:opacity-50"
                            >
                                {adding ? 'Adding...' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Edit User Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <form 
                        onSubmit={handleEditUser}
                        className="bg-white dark:bg-[#0a0f18] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 p-8 flex flex-col animate-in zoom-in-95 duration-200"
                    >
                        <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Edit User Details</h3>
                        
                        <div className="flex flex-col gap-6 mb-8">
                            {/* Employee Code Read-Only Display */}
                            <div className="flex flex-col gap-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Employee Code (Read-Only)</label>
                                <input
                                    type="text"
                                    disabled
                                    value={userToEdit?.employee_code || ''}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-100 dark:bg-[#101726]/50 border border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-500 focus:outline-none cursor-not-allowed font-mono text-[13px]"
                                />
                            </div>

                            {/* Row 1: Full Name */}
                            <div className="flex flex-col gap-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
                                    Full Name {userToEdit?.name === 'System Admin' && '(Protected)'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    disabled={userToEdit?.name === 'System Admin'}
                                    placeholder="Enter full name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className={`w-full px-6 py-4 rounded-2xl border text-[13px] transition-all focus:outline-none ${
                                        userToEdit?.name === 'System Admin'
                                            ? 'bg-slate-100 dark:bg-[#101726]/50 border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                            : 'bg-slate-50 dark:bg-[#101726] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                                />
                            </div>

                            {/* Row 2: Security Role */}
                            <div className="flex flex-col gap-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
                                    Security Role {userToEdit?.name === 'System Admin' && '(Protected)'}
                                </label>
                                <div className="relative">
                                    <select
                                        value={editRole}
                                        disabled={userToEdit?.name === 'System Admin'}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        className={`w-full px-6 py-4 rounded-2xl border transition-all appearance-none font-bold text-[13px] focus:outline-none ${
                                            userToEdit?.name === 'System Admin'
                                                ? 'bg-slate-100 dark:bg-[#101726]/50 border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                : 'bg-slate-50 dark:bg-[#101726] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
                                        }`}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        keyboard_arrow_down
                                    </span>
                                </div>
                            </div>

                            {/* Row 3: New Password (Optional) */}
                            <div className="flex flex-col gap-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">New Password (Leave blank to keep unchanged)</label>
                                <input
                                    type="text"
                                    placeholder="Enter new password to reset"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px]"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-6 py-4 rounded-xl border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-[11px] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updating}
                                className="flex-1 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[11px] transition-all cursor-pointer shadow-xl shadow-blue-600/20 disabled:opacity-50"
                            >
                                {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {userToDelete && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0a0f18] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 p-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-600/10 text-red-500 flex items-center justify-center mb-8 border border-red-200 dark:border-red-500/20 animate-pulse">
                            <span className="material-symbols-outlined text-[40px]">person_remove</span>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Delete User?</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-10 leading-relaxed">
                            Are you sure you want to delete <span className="font-bold text-slate-950 dark:text-white">{userToDelete.name}</span> ({userToDelete.employee_code})? This action is permanent and cannot be undone.
                        </p>
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setUserToDelete(null)}
                                className="flex-1 px-6 py-4 rounded-xl border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-[11px] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            >
                                Keep User
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={deleting}
                                className="flex-1 px-6 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[11px] transition-all cursor-pointer shadow-xl shadow-red-600/20 disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Users;
