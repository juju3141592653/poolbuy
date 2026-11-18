/**
 * Original product renders for each mock listing: shaded vector art on a dark
 * studio background that matches the app, drawn inline so the prototype needs no image files or licences.
 * Gradient ids are made unique per instance with useId().
 */
import { useId } from 'react';
import type { ProductImageKey } from '../logic/types';

function Art({ kind, id }: { kind: ProductImageKey; id: string }) {
  const g = (name: string) => `${id}-${name}`;
  const url = (name: string) => `url(#${g(name)})`;
  switch (kind) {
    case 'tote':
      return (
        <g>
          <defs>
            <linearGradient id={g('canvas')} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#F3ECDD" />
              <stop offset="1" stopColor="#DCCFB4" />
            </linearGradient>
          </defs>
          <path d="M64 44c0-15 7-22 16-22s16 7 16 22" fill="none" stroke="#B9A57E" strokeWidth="5" strokeLinecap="round" />
          <path d="M52 42h56l-5 58H57z" fill={url('canvas')} />
          <path d="M52 42h56l-1 6H53z" fill="#CDBD99" />
          <path d="M55 51h50" stroke="#BFAE8A" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="68" y="62" width="24" height="24" rx="3" fill="#2B2E36" />
          <path d="M74 78l6-10 6 10z" fill="#F8F5F1" />
          <circle cx="84" cy="67" r="2.2" fill="#FF8A3D" />
        </g>
      );
    case 'box':
      return (
        <g>
          <defs>
            <linearGradient id={g('top')} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#E3C696" />
              <stop offset="1" stopColor="#D2AE78" />
            </linearGradient>
            <linearGradient id={g('side')} x1="0" x2="1">
              <stop offset="0" stopColor="#C49A60" />
              <stop offset="1" stopColor="#B0864F" />
            </linearGradient>
          </defs>
          <path d="M40 46l40-16 40 16-40 16z" fill={url('top')} />
          <path d="M40 46v36l40 18V62z" fill="#CFA56B" />
          <path d="M120 46v36l-40 18V62z" fill={url('side')} />
          <path d="M60 38l40 16v10" fill="none" stroke="#9C7443" strokeWidth="1.2" opacity=".6" />
          <path d="M52 66l18 8v8l-18-8z" fill="#2B2E36" opacity=".85" />
        </g>
      );
    case 'tshirt':
      return (
        <g>
          <defs>
            <linearGradient id={g('cotton')} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#E9ECF1" />
              <stop offset="1" stopColor="#C5CBD6" />
            </linearGradient>
          </defs>
          <path d="M66 24l-26 13 9 19 10-5v47h42V51l10 5 9-19-26-13c-3 7-8 11-14 11s-11-4-14-11z" fill={url('cotton')} />
          <path d="M66 24c3 7 8 11 14 11s11-4 14-11" fill="none" stroke="#AEB6C4" strokeWidth="3" />
          <path d="M59 51v4M101 51v4" stroke="#AEB6C4" strokeWidth="1.5" />
        </g>
      );
    case 'phonecase':
      return (
        <g>
          <defs>
            <linearGradient id={g('case')} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#6E8FD0" />
              <stop offset="1" stopColor="#3F5F9E" />
            </linearGradient>
          </defs>
          <rect x="60" y="16" width="40" height="84" rx="10" fill={url('case')} />
          <rect x="60" y="16" width="40" height="84" rx="10" fill="none" stroke="#2C477A" strokeWidth="1.5" />
          <rect x="65" y="21" width="17" height="17" rx="5" fill="#22385F" />
          <circle cx="71" cy="27" r="3" fill="#2C3E66" stroke="#8FA3C8" strokeWidth="1" />
          <circle cx="77" cy="33" r="3" fill="#2C3E66" stroke="#8FA3C8" strokeWidth="1" />
          <circle cx="80" cy="66" r="9" fill="#F8F5F1" opacity=".95" />
          <circle cx="84" cy="66" r="9" fill="#FF8A3D" opacity=".9" />
        </g>
      );
    case 'mailer':
      return (
        <g>
          <defs>
            <linearGradient id={g('poly')} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#8DB3A6" />
              <stop offset="1" stopColor="#5F8C7E" />
            </linearGradient>
          </defs>
          <path d="M42 34h76v62H42z" fill={url('poly')} />
          <path d="M42 34h76v14H42z" fill="#4E7A6C" />
          <path d="M42 48h76" stroke="#3E6558" strokeWidth="1.5" />
          <rect x="62" y="62" width="36" height="18" rx="2" fill="#F4F5F7" />
          <path d="M67 68h20M67 73h14" stroke="#4E7A6C" strokeWidth="2" strokeLinecap="round" />
          <path d="M46 92h68" stroke="#FFFFFF" strokeOpacity=".25" strokeWidth="2" />
        </g>
      );
    case 'jar':
      return (
        <g>
          <defs>
            <linearGradient id={g('glass')} x1="0" x2="1">
              <stop offset="0" stopColor="#7A3A0A" />
              <stop offset=".45" stopColor="#B45F1A" />
              <stop offset="1" stopColor="#6E3208" />
            </linearGradient>
            <linearGradient id={g('wood')} x1="0" x2="1">
              <stop offset="0" stopColor="#D9BE8E" />
              <stop offset="1" stopColor="#BE9E68" />
            </linearGradient>
          </defs>
          <rect x="58" y="22" width="44" height="14" rx="3" fill={url('wood')} />
          <path d="M62 26h36M62 31h36" stroke="#A88A57" strokeWidth=".8" opacity=".7" />
          <path d="M56 38h48v52a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8z" fill={url('glass')} />
          <path d="M63 45v40" stroke="#F3C38A" strokeWidth="3" strokeLinecap="round" opacity=".55" />
          <rect x="64" y="58" width="32" height="18" rx="2" fill="#F4F0E8" />
          <path d="M69 64h22M69 69h14" stroke="#8A5A2B" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'label':
      return (
        <g>
          <path d="M44 40h72v36H44z" fill="#EDE4D3" />
          <path d="M44 40l-8 18 8 18M116 40l8 18-8 18" fill="#D6C8AE" />
          <path d="M44 40h72v36H44z" fill="none" stroke="#B9A57E" strokeWidth="1" strokeDasharray="1.5 1.5" />
          <path d="M58 54h44M64 62h32" stroke="#B66335" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
  }
}

export function ProductImage({ kind, className = '' }: { kind: ProductImageKey; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor="#3A3D46" />
          <stop offset="1" stopColor="#22242A" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000000" stopOpacity=".55" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#${id}-bg)`} />
      <ellipse cx="80" cy="104" rx="46" ry="7" fill={`url(#${id}-shadow)`} />
      <Art kind={kind} id={id} />
    </svg>
  );
}
