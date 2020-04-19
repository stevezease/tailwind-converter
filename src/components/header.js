import { Link } from 'gatsby';
import PropTypes from 'prop-types';
import React from 'react';

const Header = ({ title, svg }) => (
    <div className="flex tracking-wide text-teal-900 text-base items-center uppercase">
        <svg
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            class="w-4 h-4"
        >
            <path d={svg}></path>
        </svg>
        {title}
    </div>
);

Header.propTypes = {
    siteTitle: PropTypes.string,
    svg: PropTypes.string,
};

Header.defaultProps = {
    siteTitle: ``,
};

export default Header;
