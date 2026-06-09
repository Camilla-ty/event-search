/** State + country embed for admin city pickers and formatter. */
export const CITY_LOCATION_EMBED = `
  states (
    id,
    name,
    slug
  ),
  countries (
    id,
    name,
    slug,
    region_id
  )
`;

/** Public/marketing embed — includes macro region on country. */
export const CITY_PUBLIC_EMBED = `
  states (
    id,
    name,
    slug
  ),
  countries (
    id,
    name,
    slug,
    region_id,
    regions (
      id,
      name,
      slug
    )
  )
`;

export const CITY_ADMIN_SELECT = `
  id,
  name,
  slug,
  country_id,
  state_id,
  ${CITY_LOCATION_EMBED}
`;
