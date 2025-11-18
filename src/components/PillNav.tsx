"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { LogOut } from 'lucide-react';
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
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  onMobileMenuClick?: () => void;
  initialLoadAnimation?: boolean;
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
  ease = 'power3.easeOut',
  baseColor = 'rgba(255, 255, 255, 0.9)',
  pillColor = '#10b981',
  hoveredPillTextColor = '#ffffff',
  pillTextColor,
  onMobileMenuClick,
  initialLoadAnimation = true,
  userEmail,
  onSignOut,
  showAuth = false
}) => {
  const router = useRouter();
  const resolvedPillTextColor = pillTextColor ?? '#ffffff';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const circleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tlRefs = useRef<Array<gsap.core.Timeline | null>>([]);
  const activeTweenRefs = useRef<Array<gsap.core.Tween | null>>([]);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoTweenRef = useRef<gsap.core.Tween | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const navItemsRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLAnchorElement | HTMLElement | null>(null);

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach(circle => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement as HTMLElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`
        });

        const label = pill.querySelector<HTMLElement>('.pill-label');
        const white = pill.querySelector<HTMLElement>('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });

        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);

        if (label) {
          tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        }

        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }

        tlRefs.current[index] = tl;
      });
    };

    layout();

    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    if (document.fonts) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    const menu = mobileMenuRef.current;
    if (menu) {
      gsap.set(menu, { visibility: 'hidden', opacity: 0, scaleY: 1, y: 0 });
    }

    if (initialLoadAnimation) {
      // Removed pop-in animations - keeping structure for consistency
    }

    return () => window.removeEventListener('resize', onResize);
  }, [items, ease, initialLoadAnimation]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLogoEnter = () => {
    // Removed spin animation - keeping function for potential future use
  };

  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);

    const hamburger = hamburgerRef.current;
    const menu = mobileMenuRef.current;

    if (hamburger) {
      const lines = hamburger.querySelectorAll('.hamburger-line');
      if (newState) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      }
    }

    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(
          menu,
          { opacity: 0, y: 10, scaleY: 1 },
          {
            opacity: 1,
            y: 0,
            scaleY: 1,
            duration: 0.3,
            ease,
            transformOrigin: 'top center'
          }
        );
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: 10,
          scaleY: 1,
          duration: 0.2,
          ease,
          transformOrigin: 'top center',
          onComplete: () => {
            gsap.set(menu, { visibility: 'hidden' });
          }
        });
      }
    }

    onMobileMenuClick?.();
  };

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: resolvedPillTextColor,
    ['--nav-h']: '48px',
    ['--logo']: '40px',
    ['--pill-pad-x']: '20px',
    ['--pill-gap']: '4px'
  } as React.CSSProperties;

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
        style={cssVars}
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="Home"
          onMouseEnter={handleLogoEnter}
          role="menuitem"
          ref={el => {
            logoRef.current = el;
          }}
          className="rounded-full p-2 inline-flex items-center justify-center overflow-hidden text-2xl font-bold text-green-600 hover:text-green-500 transition-colors duration-300"
          style={{
            width: 'var(--nav-h)',
            height: 'var(--nav-h)',
          }}
        >
          {logo ? (
            <img src={logo} alt={logoAlt} ref={logoImgRef} className="w-full h-full object-cover block" />
          ) : (
            <span ref={logoImgRef} className="text-lg font-bold">EMS</span>
          )}
        </Link>

        <div
          ref={navItemsRef}
          className="relative items-center hidden lg:flex"
          style={{
            height: 'var(--nav-h)',
          }}
        >
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

              const PillContent = (
                <span className="relative">
                  {item.label}
                </span>
              );

              const baseButtonClasses =
                `relative inline-flex items-center justify-center h-10 px-4 no-underline rounded-lg border font-medium text-sm whitespace-nowrap cursor-pointer transition-all duration-200 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30`;

              return (
                <li key={`${item.href}-${i}`} role="none">
                  <Link
                    role="menuitem"
                    href={item.href}
                    className={baseButtonClasses}
                    style={buttonStyle}
                    aria-label={item.ariaLabel || item.label}
                    onMouseEnter={() => handleEnter(i)}
                    onMouseLeave={() => handleLeave(i)}
                  >
                    {PillContent}
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
            ref={hamburgerRef}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            className="lg:hidden rounded-full border-0 flex flex-col items-center justify-center gap-1 cursor-pointer p-2 relative backdrop-blur-sm"
            style={{
              width: 'var(--nav-h)',
              height: 'var(--nav-h)',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <span
              className="hamburger-line w-4 h-0.5 rounded origin-center transition-all duration-10 ease-[cubic-bezier(0.25,0.1,0.25,1)] bg-gray-300"
            />
            <span
              className="hamburger-line w-4 h-0.5 rounded origin-center transition-all duration-10 ease-[cubic-bezier(0.25,0.1,0.25,1)] bg-gray-300"
            />
          </button>
        </div>
      </nav>

      <div
        ref={mobileMenuRef}
        className="lg:hidden absolute top-full left-4 right-4 origin-top mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl"
        style={{
          zIndex: 998
        }}
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
    </div>
  );
};

export default PillNav;