
import React from 'react';
import styled from 'styled-components';

interface ContinueButtonProps {
    onClick: () => void;
    disabled?: boolean;
}

const ContinueButton: React.FC<ContinueButtonProps> = ({ onClick, disabled = false }) => {
    return (
        <StyledWrapper>
            <button
                type="button"
                className="animated-button"
                onClick={onClick}
                disabled={disabled}
                aria-disabled={disabled}
            >
                <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                </svg>
                <span className="text">Next</span>
                <span className="circle" />
                <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                </svg>
            </button>
        </StyledWrapper>
    );
};

export default ContinueButton;

const StyledWrapper = styled.div`
  .animated-button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.25rem; /* 4px */
    padding: 1rem 2.25rem; /* 16px 36px */
    border: 0.25rem solid; /* 4px */
    border-color: transparent;
    font-size: 1rem; /* 16px */
    background-color: inherit;
    border-radius: 6.25rem; /* 100px */
    font-weight: 600;
    color: greenyellow;
    box-shadow: 0 0 0 0.125rem greenyellow; /* 2px */
    cursor: pointer;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button[disabled],
  .animated-button[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .animated-button svg {
    position: absolute;
    width: 1.5rem; /* 24px */
    fill: greenyellow;
    z-index: 9;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .arr-1 {
    right: 1rem; /* 16px */
  }

  .animated-button .arr-2 {
    left: -25%;
  }

  .animated-button .circle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 1.25rem; /* 20px */
    height: 1.25rem; /* 20px */
    background-color: greenyellow;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .text {
    position: relative;
    z-index: 1;
    transform: translateX(-0.75rem); /* -12px */
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button:hover:not([disabled]) {
    box-shadow: 0 0 0 0.75rem transparent; /* 12px */
    color: #212121;
    border-radius: 0.75rem; /* 12px */
  }

  .animated-button:hover:not([disabled]) .arr-1 {
    right: -25%;
  }

  .animated-button:hover:not([disabled]) .arr-2 {
    left: 1rem; /* 16px */
  }

  .animated-button:hover:not([disabled]) .text {
    transform: translateX(0.75rem); /* 12px */
  }

  .animated-button:hover:not([disabled]) svg {
    fill: #212121;
  }

  .animated-button:active:not([disabled]) {
    scale: 0.95;
    box-shadow: 0 0 0 0.25rem greenyellow; /* 4px */
  }

  .animated-button:hover:not([disabled]) .circle {
    width: 13.75rem;  /* 220px */
    height: 13.75rem; /* 220px */
    opacity: 1;
  }
`;
