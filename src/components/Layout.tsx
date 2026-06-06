import type { ReactNode } from 'react';

type LayoutProps = {
  sidebar: ReactNode;
  main: ReactNode;
  panel: ReactNode;
};

export function Layout({ sidebar, main, panel }: LayoutProps) {
  return (
    <main className="grid h-[calc(100vh-129px)] grid-cols-[330px_minmax(420px,1fr)_360px] overflow-hidden max-xl:grid-cols-[300px_minmax(360px,1fr)] max-lg:block max-lg:h-auto">
      <aside className="overflow-y-auto border-r border-line bg-white max-lg:max-h-[46vh]">{sidebar}</aside>
      <section className="min-w-0 overflow-hidden bg-panel">{main}</section>
      <aside className="overflow-y-auto border-l border-line bg-white max-xl:col-span-2 max-xl:border-l-0 max-xl:border-t max-lg:max-h-none">
        {panel}
      </aside>
    </main>
  );
}
