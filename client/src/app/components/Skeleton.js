'use client';

import React from 'react';

/**
 * A reusable Skeleton loading component with a glassy feel.
 * @param {string} className - Additional Tailwind CSS classes for styling dimensions and layout.
 * @param {string} width - Custom width (defaults to full if not in className).
 * @param {string} height - Custom height (defaults to full if not in className).
 * @param {string} variant - 'rect' | 'circle' | 'text' (default 'rect')
 */
const Skeleton = ({ className = '', width, height, variant = 'rect' }) => {
    const baseStyles = "animate-pulse bg-white/5 backdrop-blur-sm border border-white/10";

    const variantStyles = {
        rect: "rounded-lg",
        circle: "rounded-full",
        text: "rounded h-4 w-3/4 mb-2"
    };

    const style = {
        width: width || undefined,
        height: height || undefined,
    };

    return (
        <div
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            style={style}
            aria-hidden="true"
        />
    );
};

export default Skeleton;
