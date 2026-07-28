import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0891b2',
          borderRadius: 6,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9" />
          <path d="M18 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="m17 20 1.5 1.5L21 19" />
          <path d="M6 9h12M6 13h6" />
        </svg>
      </div>
    ),
    size
  );
}
