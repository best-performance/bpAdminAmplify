import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CHeader,
  CHeaderBrand,
  CHeaderDivider,
  CHeaderToggler,
  CCol,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu } from '@coreui/icons'

import { logoNegative } from 'src/assets/brand/logo-negative'

const region = process.env.REACT_APP_REGION

// get the region name for display purposes FEATURE-TOGGLE
function getRegionName() {
  switch (region) {
    case 'ap-southeast-2':
      return `Sydney, Australia (${region})`

    case 'eu-west-2':
      return `London, England ${region}`

    default:
      return `Sydney, Australia (${region})`
  }
}

const AppHeader = () => {
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  return (
    <CHeader position="sticky" className="mb-4">
      <CContainer fluid>
        <CHeaderToggler
          className="ps-1"
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <CHeaderBrand className="mx-auto d-md-none" to="/">
          <CIcon icon={logoNegative} height={48} alt="Logo" />
        </CHeaderBrand>
      </CContainer>
      <CHeaderDivider />
      <CContainer>
        <CRow>
          <CCol sm="auto">
            <span style={{ fontWeight: 'bold' }}>Region:</span>
          </CCol>
          <CCol sm="auto">{getRegionName()}</CCol>
        </CRow>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
