import aliciaAvatar from '../assets/profiles/alicia.png';
import berlinAvatar from '../assets/profiles/berlin.png';
import bogotaAvatar from '../assets/profiles/bogota.png';
import clownAvatar from '../assets/profiles/clown.png';
import daliAvatar from '../assets/profiles/dali.png';
import darthNovaAvatar from '../assets/profiles/darth-nova.png';
import denverAvatar from '../assets/profiles/denver.png';
import elProfessorAvatar from '../assets/profiles/el-professor.png';
import enforcerAvatar from '../assets/profiles/enforcer.png';
import gasAvatar from '../assets/profiles/gas.png';
import hakunaAvatar from '../assets/profiles/hakuna.png';
import helsinkiAvatar from '../assets/profiles/helsinki.png';
import jessicaAvatar from '../assets/profiles/jessica.png';
import kaelAvatar from '../assets/profiles/kael.png';
import leonAvatar from '../assets/profiles/leon.png';
import manilaAvatar from '../assets/profiles/manila.png';
import marseilleAvatar from '../assets/profiles/marseille.png';
import moscowAvatar from '../assets/profiles/moscow.png';
import mysteryAceAvatar from '../assets/profiles/mystery-ace.png';
import nairobiAvatar from '../assets/profiles/nairobi.png';
import osloAvatar from '../assets/profiles/oslo.png';
import palermoAvatar from '../assets/profiles/palermo.png';
import raquelAvatar from '../assets/profiles/raquel.png';
import rioAvatar from '../assets/profiles/rio.png';
import salvadorDaliAvatar from '../assets/profiles/salvador-dali.png';
import seoYeonAvatar from '../assets/profiles/seo-yeon.png';
import shioriAvatar from '../assets/profiles/shiori.png';
import skullAvatar from '../assets/profiles/skull.png';
import stormtrooperAvatar from '../assets/profiles/stormtrooper.png';
import tokyoAvatar from '../assets/profiles/tokyo.png';
import vMaskAvatar from '../assets/profiles/v-mask.png';

// Fallback avatar if one is missing
import defaultAvatar from '../assets/rvitm.png';

export const PROFILE_AVATARS = [
  { name: 'alicia', label: 'Alicia', avatar: aliciaAvatar },
  { name: 'berlin', label: 'Berlin', avatar: berlinAvatar },
  { name: 'bogota', label: 'Bogota', avatar: bogotaAvatar },
  { name: 'clown', label: 'Clown', avatar: clownAvatar },
  { name: 'dali', label: 'Dali', avatar: daliAvatar },
  { name: 'darth-nova', label: 'Darth Nova', avatar: darthNovaAvatar },
  { name: 'denver', label: 'Denver', avatar: denverAvatar },
  { name: 'enforcer', label: 'Enforcer', avatar: enforcerAvatar },
  { name: 'gas', label: 'Gas', avatar: gasAvatar },
  { name: 'hakuna', label: 'Hakuna', avatar: hakunaAvatar },
  { name: 'helsinki', label: 'Helsinki', avatar: helsinkiAvatar },
  { name: 'jessica', label: 'Jessica', avatar: jessicaAvatar },
  { name: 'kael', label: 'Kael', avatar: kaelAvatar },
  { name: 'leon', label: 'Leon', avatar: leonAvatar },
  { name: 'manila', label: 'Manila', avatar: manilaAvatar },
  { name: 'marseille', label: 'Marseille', avatar: marseilleAvatar },
  { name: 'moscow', label: 'Moscow', avatar: moscowAvatar },
  { name: 'mystery-ace', label: 'Mystery Ace', avatar: mysteryAceAvatar },
  { name: 'nairobi', label: 'Nairobi', avatar: nairobiAvatar },
  { name: 'oslo', label: 'Oslo', avatar: osloAvatar },
  { name: 'palermo', label: 'Palermo', avatar: palermoAvatar },
  { name: 'el-professor', label: 'El Professor', avatar: elProfessorAvatar },
  { name: 'raquel', label: 'Lisbon (Raquel)', avatar: raquelAvatar },
  { name: 'rio', label: 'Rio', avatar: rioAvatar },
  { name: 'salvador-dali', label: 'Salvador Dali', avatar: salvadorDaliAvatar },
  { name: 'seo-yeon', label: 'Seo Yeon', avatar: seoYeonAvatar },
  { name: 'shiori', label: 'Shiori', avatar: shioriAvatar },
  { name: 'skull', label: 'Skull', avatar: skullAvatar },
  { name: 'stormtrooper', label: 'Stormtrooper', avatar: stormtrooperAvatar },
  { name: 'tokyo', label: 'Tokyo', avatar: tokyoAvatar },
  { name: 'v-mask', label: 'V Mask', avatar: vMaskAvatar },
];

export const getProfileAvatar = (name) => {
  if (!name) return defaultAvatar;
  const normalized = name.toLowerCase().trim();
  const profile = PROFILE_AVATARS.find(p => p.name === normalized);
  return profile ? profile.avatar : defaultAvatar;
};

export const getProfileLabel = (name) => {
  if (!name) return 'Unknown';
  const normalized = name.toLowerCase().trim();
  const profile = PROFILE_AVATARS.find(p => p.name === normalized);
  return profile ? profile.label : formatProfileLabel(name);
};

export const formatProfileLabel = (name) => {
  if (!name) return 'Unknown';
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const DEFAULT_PROFILE_NAME = 'berlin';
export const CUSTOM_PROFILE_VALUE = 'custom_team_name';
