// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SafeMath
 * @dev Biblioteca para operaciones matemáticas seguras con detección de overflow/underflow
 */
library SafeMath {
    /**
     * @dev Suma dos números, revierte en caso de overflow
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    /**
     * @dev Resta dos números, revierte en caso de underflow
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction underflow");
        return a - b;
    }

    /**
     * @dev Multiplica dos números, revierte en caso de overflow
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    /**
     * @dev Divide dos números, revierte en caso de división por cero
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }

    /**
     * @dev Módulo de dos números, revierte en caso de división por cero
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: modulo by zero");
        return a % b;
    }
}