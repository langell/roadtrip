import Image from 'next/image';
import Link from 'next/link';

type Props = {
  className?: string;
};

export default function Logo({ className }: Props) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary ${className ?? ''}`}
    >
      <Image
        src="/favicon.png"
        alt=""
        width={32}
        height={32}
        className="rounded-lg"
        priority
      />
      HipTrip
    </Link>
  );
}
