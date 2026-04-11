import Logo from './Logo';

export default function SimpleHeader() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center bg-wayfarer-bg/80 px-4 backdrop-blur-xl md:px-8">
      <Logo />
    </header>
  );
}
