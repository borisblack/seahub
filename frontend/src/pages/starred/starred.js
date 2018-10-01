import React, { Component } from 'react';
import { seafileAPI } from '../../utils/seafile-api';
import { common } from '../../utils/common';
import { gettext, siteRoot, loginUrl } from '../../components/constants';

class Content extends Component {

  render() {
    const {loading, error_msg, items} = this.props.data;

    if (loading) {
      return <span className="loading-icon loading-tip"></span>;
    } else if (error_msg) {
      return <p className="error text-center">{error_msg}</p>;
    } else {
      const desktop_thead_con = (
        <tr>
          <th width="5%"></th>
          <th width="40%">{gettext("File Name")}</th>
          <th width="32%">{gettext("Library")}</th>
          <th width="18%">{gettext("Last Update")}</th>
          <th width="5%"></th>
        </tr>
      );
      const mobile_thead_con = (
        <tr>
          <th width="5%"></th>
          <th width="90%">{gettext("File Name")}</th>
          <th width="5%"></th>
        </tr>
      );

      return ( 
        <table className="table table-hover table-vcenter">
          <thead>
          {window.innerWidth >= 768 ? desktop_thead_con : mobile_thead_con}
          </thead>
          <TableBody items={items} />
        </table>
      ); 
    }
  }
}

class TableBody extends Component {

  constructor(props) {
    super(props);
    this.state = {
      items: this.props.items
    };
  }

  componentDidMount() {
    this.getThumbnails();
  }

  getThumbnails() {

    // TODO
    /*
    if (!app.pageOptions.enable_thumbnail) {
    return false;
    }
    */

    let items = this.state.items.filter((item) => {
      const name = item.file_name;
      return common.imageCheck(name) || common.videoCheck(name);
    });
    if (items.length == 0) {
      return ;
    }

    const len = items.length;
    // TODO
    //const thumbnail_size = app.pageOptions.thumbnail_default_size;
    const thumbnail_size = 48;
    const _this = this;
    let get_thumbnail = function(i) {
      const cur_item = items[i];
      seafileAPI.createThumbnail(cur_item.repo_id, cur_item.path, thumbnail_size).
        then((res) => {
          cur_item.encoded_thumbnail_src = res.data.encoded_thumbnail_src;
        })
      .catch((error) => {
        // do nothing
      })
      .then(() => {
        if (i < len - 1) {
          get_thumbnail(++i);
        } else {
          // when done, `setState()`
          _this.setState({
            items: _this.state.items
          });
        }
      });
    };
    get_thumbnail(0);
  }

  render() {

    let listFilesActivities = this.state.items.map(function(item, index) {
      let file_icon_size = common.isHiDPI() ? 48 : 24; 

      item.file_icon_url = common.getFileIconUrl(item.file_name, file_icon_size);
      item.is_img = common.imageCheck(item.file_name);
      item.encoded_path = common.encodePath(item.path);

      item.thumbnail_url = item.encoded_thumbnail_src ? `${siteRoot}${item.encoded_thumbnail_src}` : '';
      item.file_view_url = `${siteRoot}lib/${item.repo_id}/file${item.encoded_path}`;
      item.file_raw_url = `${siteRoot}repo/${item.repo_id}/raw${item.encoded_path}`;

      return <Item key={index} data={item} />;
    }, this);

    return (
      <tbody>{listFilesActivities}</tbody>
    );
  }
}

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      show_op_icon: false,
      unstarred: false
    };

    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  handleMouseOver() {
    this.setState({
      show_op_icon: true
    });
  }

  handleMouseOut() {
    this.setState({
      show_op_icon: false
    });
  }

  handleClick(e) {
    e.preventDefault();

    const data = this.props.data;
    seafileAPI.unStarFile(data.repo_id, data.path)
      .then((res) => {
        this.setState({
          unstarred: true
        });
        // TODO: show feedback msg
      })
    .catch((error) => {
      // TODO: show feedback msg
    });
  }

  render() {

    if (this.state.unstarred) {
      return null;
    }

    const data = this.props.data;

    let op_classes = 'sf2-icon-delete unstar op-icon';
    op_classes += this.state.show_op_icon ? '' : ' invisible';

    const desktop_item = (
      <tr onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
        <td className="alc">
        {
          data.thumbnail_url ?
            <img className="thumbnail" src={data.thumbnail_url} alt="" /> :
            <img src={data.file_icon_url} alt={gettext("icon")} width="24" />
        }
        </td>
        <td>
        {
          data.is_img ?
            <a className="img-name-link normal" href={data.file_view_url} target="_blank" data-mfp-src={data.file_raw_url}>{data.file_name}</a> :
            <a className="normal" href={data.file_view_url} target="_blank">{data.file_name}</a>
        }
        </td>
        <td>{data.repo_name}</td>
        <td dangerouslySetInnerHTML={{__html:data.mtime_relative}}></td>
        <td>
          <a href="#" className={op_classes} title={gettext("Unstar")} aria-label={gettext("Unstar")} onClick={this.handleClick}></a>
        </td>
      </tr>
    );

    const mobile_item = (
      <tr>
        <td className="alc">
        {
          data.thumbnail_url ?
            <img className="thumbnail" src={data.thumbnail_url} alt="" /> :
            <img src={data.file_icon_url} alt={gettext("icon")} width="24" />
        }
        </td>
        <td>
        {
          data.is_img ?
            <a className="img-name-link normal" href={data.file_view_url} target="_blank" data-mfp-src={data.file_raw_url}>{data.file_name}</a> :
            <a className="normal" href={data.file_view_url} target="_blank">{data.file_name}</a>
        }
        <br />
        <span className="dirent-meta-info">{data.repo_name}</span>
        <span className="dirent-meta-info" dangerouslySetInnerHTML={{__html:data.mtime_relative}}></span>
        </td>
        <td>
          <a href="#" className="sf2-icon-delete unstar op-icon" title={gettext("Unstar")} aria-label={gettext("Unstar")} onClick={this.handleClick}></a>
        </td>
      </tr>
    );

    if (window.innerWidth >= 768) {
      return desktop_item;
    } else {
      return mobile_item;
    }
  }
}

class Starred extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error_msg: '',
      items: []
    };
  }

  componentDidMount() {
    seafileAPI.listStarred()
    .then((res) => {
      // res: {data: Array(2), status: 200, statusText: "OK", headers: {…}, config: {…}, …}
      this.setState({
        loading: false,
        items: res.data
      });
    })
    .catch((error) => {
      if (error.response) {
        if (error.response.status == 403) {
          this.setState({
            loading: false,
            error_msg: gettext("Permission denied")
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            error_msg: gettext("Error")
          });
        }

      } else {
        this.setState({
          loading: false,
          error_msg: gettext("Please check the network.")
        });
      }
    });
  }

  render() {
    return (
      <div className="cur-view-container" id="starred">
        <div className="cur-view-path">
          <h3 className="sf-heading">{gettext("Favorites")}</h3>
        </div>
        <div className="cur-view-content">
          <Content data={this.state} />
        </div>
      </div>
    );
  }
}

export default Starred;
