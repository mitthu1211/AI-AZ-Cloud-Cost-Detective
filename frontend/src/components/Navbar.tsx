import { Link, useNavigate } from 'react-router-dom';
import { Cloud, History, LogOut } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!token) return null;

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-5xl">
        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-semibold text-blue-400">
          <Cloud className="w-6 h-6" />
          <span>Cost Detective</span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link to="/history" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
            <History className="w-4 h-4" />
            History
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-300 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
