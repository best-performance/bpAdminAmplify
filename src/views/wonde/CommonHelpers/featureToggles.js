// This is the central place for all Feature toggles for BP Admin
import flagOz from './australia.png' //
import flagUk from './uk.png' //

// These are hard-coded for convenience ToDo: Save elsewhere
const UKURL = 'https://api.wonde.com/v1.0/schools'
const UKTOKEN = 'Bearer a3f049794493180ed83fb310da37715f856c3670' // new as of 9/2/2022
const AUSURL = 'https://api-ap-southeast-2.wonde.com/v1.0/schools'
const AUSTOKEN = 'Bearer 4ef8fc0053696f4202062ac598943fc1de66c606' // new as of 9/2/2022

// FEATURE-TOGGLE
export function getURL() {
  //return UKURL
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return AUSURL
    case 'eu-west-2':
      return UKURL
    default:
      return AUSURL
  }
}
// FEATURE-TOGGLE
export function getToken() {
  //return UKTOKEN
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return AUSTOKEN
    case 'eu-west-2':
      return UKTOKEN
    default:
      return AUSTOKEN
  }
}

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

export function isAUSRegion() {
  if (process.env.REACT_APP_REGION === 'ap-southeast-2') return true
  return false
}

export function isUKRegion() {
  if (process.env.REACT_APP_REGION === 'eu-west-2') return true
  return false
}

// This returns the region code
export function getRegion() {
  return process.env.REACT_APP_REGION
}

// get the region name for display purposes FEATURE-TOGGLE
export function getRegionName() {
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return `Sydney, Australia (${process.env.REACT_APP_REGION})`

    case 'eu-west-2':
      return `London, England ${process.env.REACT_APP_REGION}`

    default:
      return `Sydney, Australia (${process.env.REACT_APP_REGION})`
  }
}

// display a flag to represent the region of deployment FEATURE-TOGGLE
export function getRegionFlag() {
  switch (process.env.REACT_APP_REGION) {
    case 'ap-southeast-2':
      return flagOz

    case 'eu-west-2':
      return flagUk

    default:
      return flagOz
  }
}
