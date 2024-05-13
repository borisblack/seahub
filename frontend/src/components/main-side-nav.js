import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot, canAddRepo, canGenerateShareLink, canGenerateUploadLink, canInvitePeople } from '../utils/constants';
import { seafileAPI } from '../utils/seafile-api';
import { Utils } from '../utils/utils';
import toaster from './toast';
import Group from '../models/group';

import { canViewOrg, isDocs, isPro, isDBSqlite3, customNavItems } from '../utils/constants';

const propTypes = {
  currentTab: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tabItemClick: PropTypes.func.isRequired,
};

const SUB_NAV_ITEM_HEIGHT = 28;

class MainSideNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filesNavUnfolded: false,
      sharedExtended: false,
      closeSideBar:false,
      groupItems: [],
    };
    this.adminHeight = 0;
    this.filesNavHeight = 0;
  }

  shExtend = () => {
    this.setState({
      sharedExtended: !this.state.sharedExtended,
    });
  };

  loadGroups = () => {
    let _this = this;
    seafileAPI.listGroups().then(res =>{
      let groupList = res.data.map(item => {
        let group = new Group(item);
        return group;
      });

      this.filesNavHeight = (groupList.length + (canAddRepo ? 1 : 0) + (canViewOrg ? 1 : 0) + 1) * SUB_NAV_ITEM_HEIGHT;
      _this.setState({
        groupItems: groupList.sort((a, b) => {
          return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        })
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  tabItemClick = (e, param, id) => {
    if (window.uploader &&
      window.uploader.isUploadProgressDialogShow &&
      window.uploader.totalProgress !== 100) {
      if (!window.confirm(gettext('A file is being uploaded. Are you sure you want to leave this page?'))) {
        e.preventDefault();
        return false;
      }
      window.uploader.isUploadProgressDialogShow = false;
    }
    this.props.tabItemClick(param, id);
  };

  getActiveClass = (tab) => {
    return this.props.currentTab === tab ? 'active' : '';
  };

  renderSharedGroups() {
    return (
      <>
        {this.state.groupItems.map(item => {
          return (
            <li key={item.id} className="nav-item">
              <Link
                to={siteRoot + 'group/' + item.id + '/'}
                className={`nav-link ellipsis ${this.getActiveClass(item.name)}`}
                onClick={(e) => this.tabItemClick(e, item.name, item.id)}
              >
                <span className={`${item.parent_group_id == 0 ? 'sf3-font-group sf3-font' : 'fas fa-building'} nav-icon`} aria-hidden="true"></span>
                <span className="nav-text">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </>
    );
  }

  renderSharedAdmin() {
    let height = 0;
    if (this.state.sharedExtended) {
      if (!this.adminHeight) {
        this.adminHeight = 3 * SUB_NAV_ITEM_HEIGHT;
      }
      height = this.adminHeight;
    }
    let style = {height: height};

    let linksNavItem = null;
    if (canGenerateShareLink) {
      linksNavItem = (
        <li className="nav-item">
          <Link to={siteRoot + 'share-admin-share-links/'} className={`nav-link ellipsis ${this.getActiveClass('share-admin-share-links')}`} title={gettext('Links')} onClick={(e) => this.tabItemClick(e, 'share-admin-share-links')}>
            <span aria-hidden="true" className="sharp">#</span>
            <span className="nav-text">{gettext('Links')}</span>
          </Link>
        </li>
      );
    } else if (canGenerateUploadLink) {
      linksNavItem = (
        <li className="nav-item">
          <Link to={siteRoot + 'share-admin-upload-links/'} className={`nav-link ellipsis ${this.getActiveClass('share-admin-upload-links')}`} title={gettext('Links')} onClick={(e) => this.tabItemClick(e, 'share-admin-upload-links')}>
            <span aria-hidden="true" className="sharp">#</span>
            <span className="nav-text">{gettext('Links')}</span>
          </Link>
        </li>
      );
    }
    return (
      <ul
        id="share-admin-sub-nav"
        className={`nav sub-nav nav-pills flex-column ${this.state.sharedExtended ? 'side-panel-slide-share-admin' : 'side-panel-slide-up-share-admin'}`}
        style={style}
      >
        {canAddRepo && (
          <li className="nav-item">
            <Link to={siteRoot + 'share-admin-libs/'} className={`nav-link ellipsis ${this.getActiveClass('share-admin-libs')}`} title={gettext('Libraries')} onClick={(e) => this.tabItemClick(e, 'share-admin-libs')}>
              <span aria-hidden="true" className="sharp">#</span>
              <span className="nav-text">{gettext('Libraries')}</span>
            </Link>
          </li>
        )}
        <li className="nav-item">
          <Link to={siteRoot + 'share-admin-folders/'} className={`nav-link ellipsis ${this.getActiveClass('share-admin-folders')}`} title={gettext('Folders')} onClick={(e) => this.tabItemClick(e, 'share-admin-folders')}>
            <span aria-hidden="true" className="sharp">#</span>
            <span className="nav-text">{gettext('Folders')}</span>
          </Link>
        </li>
        {linksNavItem}
      </ul>
    );
  }

  renderCustomNavItems() {
    return (
      customNavItems.map((item, idx) => {
        return (
          <li key={idx} className="nav-item">
            <a href={item.link} className="nav-link ellipsis" title={item.desc}>
              <span className={item.icon} aria-hidden="true"></span>
              <span className="nav-text">{item.desc}</span>
            </a>
          </li>
        );
      })
    );
  }

  toggleFilesNav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({
      filesNavUnfolded: !this.state.filesNavUnfolded
    }, () => {
      if (this.state.filesNavUnfolded) {
        this.loadGroups();
      }
    });
  };

  render() {
    let showActivity = isDocs || isPro || !isDBSqlite3;
    const { filesNavUnfolded } = this.state;
    return (
      <div className="side-nav">
        <div className="side-nav-con">
          <ul className="nav nav-pills flex-column nav-container">
            <li className="nav-item flex-column" id="files">
              <Link to={ siteRoot + 'libraries/' } className={`nav-link ellipsis ${this.getActiveClass('libraries')}`} title={gettext('Files')} onClick={(e) => this.tabItemClick(e, 'libraries')}>
                <span className="sf3-font-files sf3-font" aria-hidden="true"></span>
                <span className="nav-text">{gettext('Files')}</span>
                <span className={`toggle-icon fas ${filesNavUnfolded ? 'fa-caret-down':'fa-caret-left'} ${this.getActiveClass('libraries') ? 'text-white' : ''}`} aria-hidden="true" onClick={this.toggleFilesNav}></span>
              </Link>
              <ul id="files-sub-nav" className={`nav sub-nav nav-pills flex-column ${filesNavUnfolded ? 'side-panel-slide' : 'side-panel-slide-up'}`} style={{height: filesNavUnfolded ? this.filesNavHeight : 0}}>
                {canAddRepo && (
                  <li className="nav-item">
                    <Link to={ siteRoot + 'my-libs/' } className={`nav-link ellipsis ${this.getActiveClass('my-libs') || this.getActiveClass('deleted') }`} title={gettext('My Libraries')} onClick={(e) => this.tabItemClick(e, 'my-libs')}>
                      <span className="sf3-font-mine sf3-font nav-icon" aria-hidden="true"></span>
                      <span className="nav-text">{gettext('My Libraries')}</span>
                    </Link>
                  </li>
                )}
                <li className="nav-item">
                  <Link to={siteRoot + 'shared-libs/'} className={`nav-link ellipsis ${this.getActiveClass('shared-libs')}`} title={gettext('Shared with me')} onClick={(e) => this.tabItemClick(e, 'shared-libs')}>
                    <span className="sf3-font-share-with-me sf3-font nav-icon" aria-hidden="true"></span>
                    <span className="nav-text">{gettext('Shared with me')}</span>
                  </Link>
                </li>
                {canViewOrg &&
                <li className="nav-item" onClick={(e) => this.tabItemClick(e, 'org')}>
                  <Link to={ siteRoot + 'org/' } className={`nav-link ellipsis ${this.getActiveClass('org')}`} title={gettext('Shared with all')}>
                    <span className="sf3-font-share-with-all sf3-font nav-icon" aria-hidden="true"></span>
                    <span className="nav-text">{gettext('Shared with all')}</span>
                  </Link>
                </li>
                }
                {this.renderSharedGroups()}
              </ul>
            </li>

            <li className="nav-item">
              <Link className={`nav-link ellipsis ${this.getActiveClass('starred')}`} to={siteRoot + 'starred/'} title={gettext('Favorites')} onClick={(e) => this.tabItemClick(e, 'starred')}>
                <span className="sf3-font-starred sf3-font" aria-hidden="true"></span>
                <span className="nav-text">{gettext('Favorites')}</span>
              </Link>
            </li>
            {showActivity &&
              <li className="nav-item">
                <Link className={`nav-link ellipsis ${this.getActiveClass('dashboard')}`} to={siteRoot + 'dashboard/'} title={gettext('Activities')} onClick={(e) => this.tabItemClick(e, 'dashboard')}>
                  <span className="sf3-font-activities sf3-font" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Activities')}</span>
                </Link>
              </li>
            }
            <li className="nav-item">
              <Link className={`nav-link ellipsis ${this.getActiveClass('published')}`} to={siteRoot + 'published/'} title={gettext('Wikis')} onClick={(e) => this.tabItemClick(e, 'published')}>
                <span className="sf3-font-wiki sf3-font" aria-hidden="true"></span>
                <span className="nav-text">{gettext('Wikis')}</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ellipsis ${this.getActiveClass('linked-devices')}`} to={siteRoot + 'linked-devices/'} title={gettext('Linked Devices')} onClick={(e) => this.tabItemClick(e, 'linked-devices')}>
                <span className="sf3-font-devices sf3-font" aria-hidden="true"></span>
                <span className="nav-text">{gettext('Linked Devices')}</span>
              </Link>
            </li>
            {canInvitePeople &&
              <li className="nav-item">
                <Link className={`nav-link ellipsis ${this.getActiveClass('invitations')}`} to={siteRoot + 'invitations/'} title={gettext('Invite Guest')} onClick={(e) => this.tabItemClick(e, 'invitations')}>
                  <span className="sf2-icon-invite" aria-hidden="true"></span>
                  <span className="nav-text">{gettext('Invite Guest')}</span>
                </Link>
              </li>
            }
            <li className="nav-item flex-column" id="share-admin-nav">
              <a className="nav-link ellipsis" title={gettext('Share Admin')} onClick={this.shExtend}>
                <span className="sf3-font-wrench sf3-font" aria-hidden="true"></span>
                <span className="nav-text">{gettext('Share Admin')}</span>
                <span className={`toggle-icon fas ${this.state.sharedExtended ? 'fa-caret-down':'fa-caret-left'}`} aria-hidden="true"></span>
              </a>
              {this.renderSharedAdmin()}
            </li>
            {customNavItems && this.renderCustomNavItems()}
          </ul>
        </div>
      </div>
    );
  }
}

MainSideNav.propTypes = propTypes;

export default MainSideNav;
