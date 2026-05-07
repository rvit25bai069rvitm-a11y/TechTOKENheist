const PROFILE_NAMES = [
    'alicia',
    'berlin',
    'bogota',
    'clown',
    'dali',
    'denver',
    'el_professor',
    'gas',
    'hakuna',
    'helsinki',
    'manila',
    'marseille',
    'moscow',
    'nairobi',
    'oslo',
    'palermo',
    'professor',
    'raquel',
    'rio',
    'salvador_dali',
    'skull',
    'stormtrooper',
    'tokyo',
    'v_mask',
]

const formatProfileLabel = (name) => name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export const DEFAULT_PROFILE_NAME = 'v_mask'

export const PROFILE_AVATARS = PROFILE_NAMES.map((name) => ({
    name,
    label: formatProfileLabel(name),
    src: new URL(`../../assets/output/${name}.png`, import.meta.url).href,
}))

export const getProfileAvatar = (name) => {
    const defaultAvatar = PROFILE_AVATARS.find((profile) => profile.name === DEFAULT_PROFILE_NAME) || PROFILE_AVATARS[0]
    return PROFILE_AVATARS.find((profile) => profile.name === name)?.src || defaultAvatar?.src
}

export const getProfileLabel = (name) => PROFILE_AVATARS.find((profile) => profile.name === name)?.label || formatProfileLabel(name || '')

export const isProfileName = (name) => PROFILE_NAMES.includes(name)
