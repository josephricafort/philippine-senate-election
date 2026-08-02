import type { CSSProperties } from 'react';

import { getCandidatePhoto } from '@/lib/candidate-photos';

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/[\s,]+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

type Props = {
  senatorId: string;
  senatorName: string;
  active: boolean;
  className?: string;
  fallbackBackgroundColor?: string;
  fallbackTextColor?: string;
};

export default function CandidateAvatar({
  senatorId,
  senatorName,
  active,
  className = 'w-9 h-9 text-sm',
  fallbackBackgroundColor,
  fallbackTextColor,
}: Props) {
  const photo = getCandidatePhoto(senatorId);

  if (photo) {
    const transformParts: string[] = [];

    if (photo.offsetX || photo.offsetY) {
      transformParts.push(`translate(${photo.offsetX ?? '0'}, ${photo.offsetY ?? '0'})`);
    }

    if (photo.zoom) {
      transformParts.push(`scale(${photo.zoom})`);
    }

    if (photo.rotate) {
      transformParts.push(`rotate(${photo.rotate})`);
    }

    const style: CSSProperties = {
      objectFit: photo.fit ?? 'cover',
      objectPosition: photo.position ?? 'center',
      transform: transformParts.length ? transformParts.join(' ') : undefined,
      transformOrigin: transformParts.length ? 'center' : undefined,
    };

    return (
      <div className={`${className} overflow-hidden rounded-full shrink-0 select-none`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.path}
          alt={senatorName}
          className="h-full w-full"
          style={style}
        />
      </div>
    );
  }

  const fallbackStyle: CSSProperties | undefined = !photo && fallbackBackgroundColor
    ? {
        backgroundColor: fallbackBackgroundColor,
        color: fallbackTextColor ?? '#ffffff',
      }
    : undefined;

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-bold shrink-0 select-none ${active && !fallbackStyle ? 'bg-primary text-primary-foreground' : !fallbackStyle ? 'bg-destructive/20 text-destructive' : ''}`}
      style={fallbackStyle}
    >
      {initials(senatorName)}
    </div>
  );
}
