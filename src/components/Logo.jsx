import React from 'react';

/**
 * Logo OryAgro — usa o ícone PWA (mesmo do app instalado).
 * Tamanhos comuns: 24, 32, 40, 56, 64, 96.
 * O ícone 192 escala bem para qualquer tamanho via CSS.
 *
 * @param {object} props
 * @param {number} [props.size=40]
 * @param {string} [props.className]
 * @param {object} [props.style]
 * @param {string} [props.alt='OryAgro']
 */
export default function Logo({ size = 40, className = '', style = {}, alt = 'OryAgro' }) {
  return (
    <img
      src="/icons/icon-192.png"
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={`select-none ${className}`}
      style={{
        width: size,
        height: size,
        display: 'block',
        ...style,
      }}
    />
  );
}
