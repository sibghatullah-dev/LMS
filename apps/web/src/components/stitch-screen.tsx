'use client';

export function StitchScreen({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      title={title}
      src={src}
      className="block h-screen w-screen border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
    />
  );
}
