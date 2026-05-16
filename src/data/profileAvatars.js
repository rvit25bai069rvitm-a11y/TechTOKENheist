const defaultAvatar = new URL('../assets/rvitm.png', import.meta.url).href;

export const PROFILE_AVATARS = [
  { name: 'alicia', label: 'Alicia', avatar: new URL('../assets/profiles/alicia.png', import.meta.url).href },
  { name: 'berlin', label: 'Berlin', avatar: new URL('../assets/profiles/berlin.png', import.meta.url).href },
  { name: 'bogota', label: 'Bogota', avatar: new URL('../assets/profiles/bogota.png', import.meta.url).href },
  { name: 'clown', label: 'Clown', avatar: new URL('../assets/profiles/clown.png', import.meta.url).href },
  { name: 'dali', label: 'Dali', avatar: new URL('../assets/profiles/dali.png', import.meta.url).href },
  { name: 'darth-nova', label: 'Darth Nova', avatar: new URL('../assets/profiles/darth-nova.png', import.meta.url).href },
  { name: 'denver', label: 'Denver', avatar: new URL('../assets/profiles/denver.png', import.meta.url).href },
  { name: 'enforcer', label: 'Enforcer', avatar: new URL('../assets/profiles/enforcer.png', import.meta.url).href },
  { name: 'gas', label: 'Gas', avatar: new URL('../assets/profiles/gas.png', import.meta.url).href },
  { name: 'hakuna', label: 'Hakuna', avatar: new URL('../assets/profiles/hakuna.png', import.meta.url).href },
  { name: 'helsinki', label: 'Helsinki', avatar: new URL('../assets/profiles/helsinki.png', import.meta.url).href },
  { name: 'jessica', label: 'Jessica', avatar: new URL('../assets/profiles/jessica.png', import.meta.url).href },
  { name: 'kael', label: 'Kael', avatar: new URL('../assets/profiles/kael.png', import.meta.url).href },
  { name: 'leon', label: 'Leon', avatar: new URL('../assets/profiles/leon.png', import.meta.url).href },
  { name: 'manila', label: 'Manila', avatar: new URL('../assets/profiles/manila.png', import.meta.url).href },
  { name: 'marseille', label: 'Marseille', avatar: new URL('../assets/profiles/marseille.png', import.meta.url).href },
  { name: 'moscow', label: 'Moscow', avatar: new URL('../assets/profiles/moscow.png', import.meta.url).href },
  { name: 'mystery-ace', label: 'Mystery Ace', avatar: new URL('../assets/profiles/mystery-ace.png', import.meta.url).href },
  { name: 'nairobi', label: 'Nairobi', avatar: new URL('../assets/profiles/nairobi.png', import.meta.url).href },
  { name: 'oslo', label: 'Oslo', avatar: new URL('../assets/profiles/oslo.png', import.meta.url).href },
  { name: 'palermo', label: 'Palermo', avatar: new URL('../assets/profiles/palermo.png', import.meta.url).href },
  { name: 'el-professor', label: 'El Professor', avatar: new URL('../assets/profiles/el-professor.png', import.meta.url).href },
  { name: 'raquel', label: 'Lisbon (Raquel)', avatar: new URL('../assets/profiles/raquel.png', import.meta.url).href },
  { name: 'rio', label: 'Rio', avatar: new URL('../assets/profiles/rio.png', import.meta.url).href },
  { name: 'salvador-dali', label: 'Salvador Dali', avatar: new URL('../assets/profiles/salvador-dali.png', import.meta.url).href },
  { name: 'seo-yeon', label: 'Seo Yeon', avatar: new URL('../assets/profiles/seo-yeon.png', import.meta.url).href },
  { name: 'shiori', label: 'Shiori', avatar: new URL('../assets/profiles/shiori.png', import.meta.url).href },
  { name: 'skull', label: 'Skull', avatar: new URL('../assets/profiles/skull.png', import.meta.url).href },
  { name: 'stormtrooper', label: 'Stormtrooper', avatar: new URL('../assets/profiles/stormtrooper.png', import.meta.url).href },
  { name: 'tokyo', label: 'Tokyo', avatar: new URL('../assets/profiles/tokyo.png', import.meta.url).href },
  { name: 'v-mask', label: 'V Mask', avatar: new URL('../assets/profiles/v-mask.png', import.meta.url).href },
];

export const getProfileAvatar = (name) => {
  if (!name) return defaultAvatar;
  const normalized = name.toLowerCase().trim();
  const profile = PROFILE_AVATARS.find((p) => p.name === normalized);
  return profile ? profile.avatar : defaultAvatar;
};

export const getProfileLabel = (name) => {
  if (!name) return 'Unknown';
  const normalized = name.toLowerCase().trim();
  const profile = PROFILE_AVATARS.find((p) => p.name === normalized);
  return profile ? profile.label : formatProfileLabel(name);
};

export const formatProfileLabel = (name) => {
  if (!name) return 'Unknown';
  return name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const DEFAULT_PROFILE_NAME = 'berlin';
export const CUSTOM_PROFILE_VALUE = 'custom_team_name';
