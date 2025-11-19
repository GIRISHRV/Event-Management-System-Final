"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export type PillNavItem = {
  label: string;
  href: string;
  ariaLabel?: string;
};

export interface PillNavProps {
  logo?: string;
  logoAlt?: string;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  onMobileMenuClick?: () => void;
  userEmail?: string;
  onSignOut?: () => void;
  showAuth?: boolean;
}

const PillNav: React.FC<PillNavProps> = ({
  logo,
  logoAlt = 'EMS Logo',
  items,
  activeHref,
  className = '',
  onMobileMenuClick,
  userEmail,
  onSignOut,
  showAuth = false
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    onMobileMenuClick?.();
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 w-full border-b"
      style={{
        background: 'rgba(39, 39, 42, 0.3)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
      }}
    >
      <nav
        className={`w-full flex items-center justify-between max-w-7xl mx-auto px-6 py-3 ${className}`}
        aria-label="Primary"
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="Home"
          className="rounded-full p-2 inline-flex items-center justify-center overflow-hidden text-2xl font-bold text-green-600 hover:text-green-500 transition-colors duration-300 h-12 w-12"
        >
          {logo ? (
            <img src={logo} alt={logoAlt} className="w-full h-full object-cover block" />
          ) : (
            <span className="text-lg font-bold">EMS</span>
          )}
        </Link>

        <div className="relative items-center hidden lg:flex h-12">
          <ul
            role="menubar"
            className="list-none flex items-center m-0 gap-2 h-full"
          >
            {items.map((item, i) => {
              const isActive = activeHref === item.href;

              const buttonStyle: React.CSSProperties = {
                background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                color: isActive ? 'rgb(34, 197, 94)' : 'rgb(156, 163, 175)',
                borderColor: isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(75, 85, 99, 0.3)',
                transition: 'all 0.2s ease'
              };

              return (
                <li key={`${item.href}-${i}`} role="none">
                  <Link
                    role="menuitem"
                    href={item.href}
                    className="relative inline-flex items-center justify-center h-10 px-4 no-underline rounded-lg border font-medium text-sm whitespace-nowrap cursor-pointer transition-all duration-200 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"
                    style={buttonStyle}
                    aria-label={item.ariaLabel || item.label}
                  >
                    <span className="relative">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Side - Auth & Theme */}
        <div className="flex items-center gap-4">
          {showAuth && userEmail && (
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-gray-300 font-medium">
                {userEmail}
              </span>
              <button
                onClick={onSignOut}
                className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
          
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            className="lg:hidden rounded-full border-0 flex items-center justify-center gap-1 cursor-pointer p-2 relative backdrop-blur-sm h-12 w-12 bg-white/10 border-white/10"
          >
            {isMobileMenuOpen ? <X className="text-gray-300" /> : <Menu className="text-gray-300" />}
          </button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden absolute top-full left-4 right-4 origin-top mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50"
        >
          <ul className="list-none m-0 p-3 flex flex-col gap-1">
            {items.map((item, index) => {
              const isActive = activeHref === item.href;
              
              return (
                <li key={`mobile-${item.href}-${index}`}>
                  <Link
                    href={item.href}
                    className={`block py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive 
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30' 
                        : 'text-gray-300 hover:bg-zinc-800 hover:text-green-400'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            
            {showAuth && userEmail && (
              <>
                <li className="border-t border-zinc-700 pt-3 mt-2">
                  <span className="block py-2 px-4 text-xs text-gray-400 font-medium">
                    {userEmail}
                  </span>
                </li>
                <li>
                  <button
                    onClick={onSignOut}
                    className="w-full text-left py-2.5 px-4 text-sm font-medium rounded-lg text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PillNav;