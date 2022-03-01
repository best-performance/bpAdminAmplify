export function getYearCodeForYear0() {
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return 'FY' // Foundation Year in Australia
    case 'eu-west-2':
      return 'R' // Reception in UK
    default:
      return 'FY'
  }
}
