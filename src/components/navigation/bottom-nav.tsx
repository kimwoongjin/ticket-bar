'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: '홈' },
  { href: '/tickets', label: '티켓' },
  { href: '/logs', label: '기록' },
  { href: '/settings', label: '설정' },
];

const BottomNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-4 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[44px] flex-col items-center justify-center gap-1"
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`h-1 w-10 rounded-full ${isActive ? 'bg-amber-600' : 'bg-slate-300'}`}
                aria-hidden="true"
              />
              <span
                className={`text-xs font-semibold ${isActive ? 'text-amber-700' : 'text-slate-500'}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
