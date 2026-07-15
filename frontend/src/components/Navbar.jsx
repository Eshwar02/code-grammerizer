import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { LayoutDashboard, Upload, LogOut, User, ChevronDown, Moon, Sun, Users, FolderGit2 } from 'lucide-react'
import CGLogo from './CGLogo'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-ink-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <CGLogo />
        </Link>

        {user && (
          <div className="flex items-center gap-0.5">
            <Link to="/dashboard"
              className={`flex items-center gap-1.5 text-sm px-3 py-2 transition-colors ${
                isActive('/dashboard')
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium'
                  : 'text-ink-600 dark:text-gray-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-50 dark:hover:bg-gray-800'
              }`}>
              <LayoutDashboard size={14} /> Dashboard
            </Link>
            <Link to="/upload"
              className={`flex items-center gap-1.5 text-sm px-3 py-2 transition-colors ${
                isActive('/upload')
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium'
                  : 'text-ink-600 dark:text-gray-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-50 dark:hover:bg-gray-800'
              }`}>
              <Upload size={14} /> New Review
            </Link>

            <Link to="/projects"
              className={`flex items-center gap-1.5 text-sm px-3 py-2 transition-colors ${
                location.pathname === '/projects'
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium'
                  : 'text-ink-600 dark:text-gray-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-50 dark:hover:bg-gray-800'
              }`}>
              <FolderGit2 size={14} /> Projects
            </Link>

            <Link to="/workspaces"
              className={`flex items-center gap-1.5 text-sm px-3 py-2 transition-colors ${
                location.pathname.startsWith('/workspace')
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium'
                  : 'text-ink-600 dark:text-gray-400 hover:text-ink-900 dark:hover:text-white hover:bg-ink-50 dark:hover:bg-gray-800'
              }`}>
              <Users size={14} /> Teams
            </Link>

            <div className="w-px h-4 bg-ink-200 dark:bg-gray-700 mx-2" />

            {/* Theme toggle */}
            <button onClick={toggle}
              className="w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-700 dark:text-gray-400 dark:hover:text-white transition-colors"
              title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-sm text-ink-600 dark:text-gray-400 hover:text-ink-900 dark:hover:text-white px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-gray-800 transition-colors">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-6 h-6 object-cover" />
                ) : (
                  <div className="w-6 h-6 bg-blue-400 flex items-center justify-center text-white text-xs font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="hidden sm:block font-medium text-ink-800 dark:text-gray-200">{user.name}</span>
                <ChevronDown size={13} className={`text-ink-400 dark:text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-ink-200 dark:border-gray-700 shadow-lg z-50">
                  <div className="px-3 py-2 border-b border-ink-100 dark:border-gray-700">
                    <p className="text-xs font-semibold text-ink-800 dark:text-gray-200 truncate">{user.name}</p>
                    <p className="text-xs text-ink-400 dark:text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-ink-600 dark:text-gray-400 hover:bg-ink-50 dark:hover:bg-gray-800 transition-colors">
                    <User size={13} /> Profile
                  </Link>
                  <button
                    onClick={() => { logout(); navigate('/login'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
