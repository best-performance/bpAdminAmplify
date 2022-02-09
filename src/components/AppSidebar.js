import React, { useState, useContext, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { CSidebar, CSidebarNav, CSidebarToggler, CContainer, CCol, CRow } from '@coreui/react'
import flagOz from './australia.png' //
import flagUk from './uk.png' //
import { AppSidebarNav } from './AppSidebarNav'
import SimpleBar from 'simplebar-react'
import 'simplebar/dist/simplebar.min.css'
// sidebar nav config
import navigation from '../_nav'
import loggedInContext from 'src/loggedInContext'
import _ from 'lodash'

const region = process.env.REACT_APP_REGION

// display a flag to represent the region of deployment FEATURE-TOGGLE
function getFlag() {
  switch (region) {
    case 'ap-southeast-2':
      return flagOz

    case 'eu-west-2':
      return flagUk

    default:
      return flagOz
  }
}

const AppSidebar = () => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { loggedIn } = useContext(loggedInContext)

  const [navItems, setNavItems] = useState([])

  useEffect(() => {
    const items = _.chain(navigation)
      .filter((item) => (!item.visibleWithoutLogin && !loggedIn.username ? false : true))
      .value()
    setNavItems(items)
  }, [loggedIn])

  return (
    <CSidebar
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: 'set', sidebarShow: visible })
      }}
    >
      <CContainer fluid>
        <CRow>
          <CCol style={{ textAlign: 'center' }}>
            <img src={getFlag()} alt="" width="100" height="70"></img>
          </CCol>
        </CRow>
      </CContainer>

      <CSidebarNav>
        <SimpleBar>
          <AppSidebarNav items={navItems} />
        </SimpleBar>
      </CSidebarNav>
      <CSidebarToggler
        className="d-none d-lg-flex"
        onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
      />
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
