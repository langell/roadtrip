type Stop = { lat: number; lng: number };

type Props = {
  stops: Stop[];
  mapsKey: string;
};

export default function MiniRouteMap({ stops, mapsKey }: Props) {
  if (!mapsKey || stops.length < 2) return null;

  const params = new URLSearchParams({
    size: '600x180',
    scale: '2',
    maptype: 'roadmap',
    key: mapsKey,
  });

  // Route polyline
  const pathCoords = stops.map((s) => `${s.lat},${s.lng}`).join('|');
  params.append('path', `color:0x1B4332CC|weight:2|${pathCoords}`);

  // Markers
  stops.forEach((s) => {
    params.append('markers', `color:0x1B4332|size:tiny|${s.lat},${s.lng}`);
  });

  // Muted map style
  params.append('style', 'feature:poi|visibility:off');
  params.append('style', 'feature:transit|visibility:off');
  params.append('style', 'feature:road|element:labels|visibility:off');
  params.append('style', 'feature:road|element:geometry|color:0xffffff');
  params.append('style', 'feature:road.arterial|element:geometry|color:0xe8e8e3');
  params.append('style', 'feature:landscape|element:geometry|color:0xf4f4ef');
  params.append('style', 'feature:water|element:geometry|color:0xc8d8e0');

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  return (
    <img
      src={url}
      alt="Route map"
      className="mt-3 w-full rounded-xl object-cover"
      style={{ height: '120px' }}
      loading="lazy"
    />
  );
}
