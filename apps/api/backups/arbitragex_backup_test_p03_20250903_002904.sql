--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-0+deb12u1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-0+deb12u1)

-- Started on 2025-09-03 00:29:04 UTC

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS arbitragex_pro;
--
-- TOC entry 3524 (class 1262 OID 16388)
-- Name: arbitragex_pro; Type: DATABASE; Schema: -; Owner: arbitragex
--

CREATE DATABASE arbitragex_pro WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE arbitragex_pro OWNER TO arbitragex;

\connect arbitragex_pro

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 864 (class 1247 OID 16448)
-- Name: ExecutionMode; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."ExecutionMode" AS ENUM (
    'SIMULATION',
    'PAPER_TRADING',
    'LIVE_TRADING'
);


ALTER TYPE public."ExecutionMode" OWNER TO arbitragex;

--
-- TOC entry 867 (class 1247 OID 16456)
-- Name: ExecutionStatus; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."ExecutionStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'TIMEOUT'
);


ALTER TYPE public."ExecutionStatus" OWNER TO arbitragex;

--
-- TOC entry 861 (class 1247 OID 16432)
-- Name: OpportunityStatus; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."OpportunityStatus" AS ENUM (
    'DETECTED',
    'ANALYZING',
    'READY',
    'EXECUTING',
    'EXECUTED',
    'FAILED',
    'EXPIRED'
);


ALTER TYPE public."OpportunityStatus" OWNER TO arbitragex;

--
-- TOC entry 873 (class 1247 OID 16484)
-- Name: StepStatus; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."StepStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'SKIPPED'
);


ALTER TYPE public."StepStatus" OWNER TO arbitragex;

--
-- TOC entry 870 (class 1247 OID 16470)
-- Name: StepType; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."StepType" AS ENUM (
    'APPROVAL',
    'FLASH_LOAN_START',
    'SWAP',
    'BRIDGE',
    'FLASH_LOAN_REPAY',
    'PROFIT_EXTRACTION'
);


ALTER TYPE public."StepType" OWNER TO arbitragex;

--
-- TOC entry 852 (class 1247 OID 16400)
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'ACTIVE',
    'CANCELED',
    'PAST_DUE',
    'UNPAID',
    'TRIALING'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO arbitragex;

--
-- TOC entry 849 (class 1247 OID 16390)
-- Name: TenantStatus; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."TenantStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'PENDING'
);


ALTER TYPE public."TenantStatus" OWNER TO arbitragex;

--
-- TOC entry 855 (class 1247 OID 16412)
-- Name: UserRole; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'USER',
    'VIEWER'
);


ALTER TYPE public."UserRole" OWNER TO arbitragex;

--
-- TOC entry 858 (class 1247 OID 16422)
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: arbitragex
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'PENDING_VERIFICATION'
);


ALTER TYPE public."UserStatus" OWNER TO arbitragex;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 216 (class 1259 OID 16514)
-- Name: api_keys; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.api_keys (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    permissions jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.api_keys OWNER TO arbitragex;

--
-- TOC entry 219 (class 1259 OID 16541)
-- Name: arbitrage_configs; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.arbitrage_configs (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    strategies jsonb NOT NULL,
    blockchains jsonb NOT NULL,
    risk_settings jsonb NOT NULL,
    slippage_tolerance numeric(5,4) DEFAULT 0.005 NOT NULL,
    min_profit_threshold numeric(10,4) DEFAULT 0.02 NOT NULL,
    max_position_size numeric(20,8) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.arbitrage_configs OWNER TO arbitragex;

--
-- TOC entry 221 (class 1259 OID 16561)
-- Name: arbitrage_executions; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.arbitrage_executions (
    id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    execution_mode public."ExecutionMode" NOT NULL,
    status public."ExecutionStatus" DEFAULT 'PENDING'::public."ExecutionStatus" NOT NULL,
    transaction_hashes jsonb NOT NULL,
    actual_profit numeric(30,18),
    actual_gas_used text,
    execution_time_ms integer,
    slippage_actual numeric(10,6),
    slippage_tolerance numeric(5,4) DEFAULT 0.005 NOT NULL,
    max_gas_price text,
    deadline timestamp(3) without time zone NOT NULL,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.arbitrage_executions OWNER TO arbitragex;

--
-- TOC entry 220 (class 1259 OID 16552)
-- Name: arbitrage_opportunities; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.arbitrage_opportunities (
    id uuid NOT NULL,
    config_id uuid NOT NULL,
    strategy_name text NOT NULL,
    blockchain_from text NOT NULL,
    blockchain_to text NOT NULL,
    token_in text NOT NULL,
    token_out text NOT NULL,
    token_symbol text NOT NULL,
    amount_in numeric(30,18) NOT NULL,
    expected_amount_out numeric(30,18) NOT NULL,
    profit_amount numeric(30,18) NOT NULL,
    profit_percentage numeric(10,6) NOT NULL,
    profit_usd numeric(20,8) NOT NULL,
    confidence_score numeric(3,2) NOT NULL,
    gas_estimate text NOT NULL,
    dex_path jsonb NOT NULL,
    triangular_path jsonb,
    flash_loan_data jsonb,
    status public."OpportunityStatus" DEFAULT 'DETECTED'::public."OpportunityStatus" NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    detected_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.arbitrage_opportunities OWNER TO arbitragex;

--
-- TOC entry 223 (class 1259 OID 16582)
-- Name: blockchain_networks; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.blockchain_networks (
    id uuid NOT NULL,
    network_id text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    chain_id integer NOT NULL,
    rpc_url text NOT NULL,
    ws_url text,
    explorer_url text NOT NULL,
    block_time integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_block bigint,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.blockchain_networks OWNER TO arbitragex;

--
-- TOC entry 224 (class 1259 OID 16591)
-- Name: dex_protocols; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.dex_protocols (
    id uuid NOT NULL,
    network_id uuid NOT NULL,
    name text NOT NULL,
    protocol_type text NOT NULL,
    router_address text NOT NULL,
    factory_address text,
    supports_flash_loans boolean DEFAULT false NOT NULL,
    fee_percentage numeric(6,4) NOT NULL,
    tvl_usd numeric(20,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.dex_protocols OWNER TO arbitragex;

--
-- TOC entry 222 (class 1259 OID 16573)
-- Name: execution_steps; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.execution_steps (
    id uuid NOT NULL,
    execution_id uuid NOT NULL,
    step_number integer NOT NULL,
    step_type public."StepType" NOT NULL,
    blockchain text NOT NULL,
    transaction_hash text,
    status public."StepStatus" DEFAULT 'PENDING'::public."StepStatus" NOT NULL,
    token_in text,
    token_out text,
    amount_in numeric(30,18),
    amount_out numeric(30,18),
    dex_exchange text,
    pool_address text,
    gas_used text,
    error_message text,
    started_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.execution_steps OWNER TO arbitragex;

--
-- TOC entry 226 (class 1259 OID 16610)
-- Name: network_status; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.network_status (
    id uuid NOT NULL,
    network_id uuid NOT NULL,
    block_number bigint NOT NULL,
    gas_price_gwei numeric(10,4) NOT NULL,
    is_syncing boolean DEFAULT false NOT NULL,
    peer_count integer,
    response_time_ms integer NOT NULL,
    is_healthy boolean DEFAULT true NOT NULL,
    checked_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.network_status OWNER TO arbitragex;

--
-- TOC entry 218 (class 1259 OID 16532)
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.subscription_plans (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    stripe_price_id text,
    price_monthly numeric(10,2) NOT NULL,
    features jsonb NOT NULL,
    limits jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.subscription_plans OWNER TO arbitragex;

--
-- TOC entry 217 (class 1259 OID 16523)
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    stripe_subscription_id text,
    stripe_customer_id text,
    plan_id uuid NOT NULL,
    status public."SubscriptionStatus" NOT NULL,
    current_period_start timestamp(3) without time zone NOT NULL,
    current_period_end timestamp(3) without time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO arbitragex;

--
-- TOC entry 214 (class 1259 OID 16495)
-- Name: tenants; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.tenants (
    id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    domain text,
    branding jsonb,
    subscription_id uuid,
    settings jsonb,
    status public."TenantStatus" DEFAULT 'ACTIVE'::public."TenantStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tenants OWNER TO arbitragex;

--
-- TOC entry 225 (class 1259 OID 16601)
-- Name: trading_pairs; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.trading_pairs (
    id uuid NOT NULL,
    dex_protocol_id uuid NOT NULL,
    token0_address text NOT NULL,
    token1_address text NOT NULL,
    token0_symbol text NOT NULL,
    token1_symbol text NOT NULL,
    pair_address text NOT NULL,
    reserve0 numeric(30,18) NOT NULL,
    reserve1 numeric(30,18) NOT NULL,
    price numeric(30,18) NOT NULL,
    volume_24h_usd numeric(20,2),
    liquidity_usd numeric(20,2),
    last_updated timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.trading_pairs OWNER TO arbitragex;

--
-- TOC entry 215 (class 1259 OID 16504)
-- Name: users; Type: TABLE; Schema: public; Owner: arbitragex
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    password_hash text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    last_login_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO arbitragex;

--
-- TOC entry 3508 (class 0 OID 16514)
-- Dependencies: 216
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.api_keys (id, tenant_id, user_id, name, key_hash, permissions, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 3511 (class 0 OID 16541)
-- Dependencies: 219
-- Data for Name: arbitrage_configs; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.arbitrage_configs (id, tenant_id, name, description, strategies, blockchains, risk_settings, slippage_tolerance, min_profit_threshold, max_position_size, is_active, created_at, updated_at) FROM stdin;
88b59bfe-4f09-4924-a176-d3214b4dcade	550e8400-e29b-41d4-a716-446655440000	Multi-Chain Arbitrage Strategy	Aggressive arbitrage strategy across Ethereum, BSC, and Polygon	["triangular_arbitrage", "cross_chain_arbitrage", "flash_loan_arbitrage"]	["ethereum", "bsc", "polygon", "arbitrum"]	{"max_slippage": 0.01, "max_gas_price_gwei": 100, "stop_loss_percentage": 0.05, "max_concurrent_executions": 3}	0.0050	0.0150	10000.00000000	t	2025-09-03 00:28:24.798	2025-09-03 00:28:24.798
\.


--
-- TOC entry 3513 (class 0 OID 16561)
-- Dependencies: 221
-- Data for Name: arbitrage_executions; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.arbitrage_executions (id, opportunity_id, tenant_id, user_id, execution_mode, status, transaction_hashes, actual_profit, actual_gas_used, execution_time_ms, slippage_actual, slippage_tolerance, max_gas_price, deadline, error_message, retry_count, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3512 (class 0 OID 16552)
-- Dependencies: 220
-- Data for Name: arbitrage_opportunities; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.arbitrage_opportunities (id, config_id, strategy_name, blockchain_from, blockchain_to, token_in, token_out, token_symbol, amount_in, expected_amount_out, profit_amount, profit_percentage, profit_usd, confidence_score, gas_estimate, dex_path, triangular_path, flash_loan_data, status, expires_at, detected_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3515 (class 0 OID 16582)
-- Dependencies: 223
-- Data for Name: blockchain_networks; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.blockchain_networks (id, network_id, name, symbol, chain_id, rpc_url, ws_url, explorer_url, block_time, is_active, last_sync_block, created_at, updated_at) FROM stdin;
d15ebdf8-42e5-4982-98fe-1083c3ad80c9	ethereum	Ethereum Mainnet	ETH	1	https://ethereum.publicnode.com	wss://ethereum.publicnode.com	https://etherscan.io	12	t	\N	2025-09-03 00:28:24.792	2025-09-03 00:28:24.792
a48d3f32-f736-46ff-91f2-f835b09b8e8b	bsc	BNB Smart Chain	BNB	56	https://bsc-dataseed1.binance.org	\N	https://bscscan.com	3	t	\N	2025-09-03 00:28:24.792	2025-09-03 00:28:24.792
5644b1e9-989f-473a-b307-ef47c202e0cc	polygon	Polygon Mainnet	MATIC	137	https://polygon-rpc.com	wss://polygon-rpc.com	https://polygonscan.com	2	t	\N	2025-09-03 00:28:24.792	2025-09-03 00:28:24.792
e81979df-d13f-48ae-b2e7-2de185a54d32	arbitrum	Arbitrum One	ETH	42161	https://arbitrum.publicnode.com	wss://arbitrum.publicnode.com	https://arbiscan.io	1	t	\N	2025-09-03 00:28:24.792	2025-09-03 00:28:24.792
c26da9d6-7420-4677-ba70-9480554e0a1a	optimism	Optimism	ETH	10	https://optimism.publicnode.com	wss://optimism.publicnode.com	https://optimistic.etherscan.io	2	t	\N	2025-09-03 00:28:24.792	2025-09-03 00:28:24.792
\.


--
-- TOC entry 3516 (class 0 OID 16591)
-- Dependencies: 224
-- Data for Name: dex_protocols; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.dex_protocols (id, network_id, name, protocol_type, router_address, factory_address, supports_flash_loans, fee_percentage, tvl_usd, is_active, created_at, updated_at) FROM stdin;
711b8efc-3aa7-490c-b2a4-aebaaf7ba006	d15ebdf8-42e5-4982-98fe-1083c3ad80c9	Uniswap V3	uniswap_v3	0xE592427A0AEce92De3Edee1F18E0157C05861564	0x1F98431c8aD98523631AE4a59f267346ea31F984	t	0.0030	5200000000.00	t	2025-09-03 00:28:24.794	2025-09-03 00:28:24.794
5c9c9131-130b-4caf-aa6e-e7884caafc23	d15ebdf8-42e5-4982-98fe-1083c3ad80c9	SushiSwap	uniswap_v2	0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F	0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac	f	0.0030	720000000.00	t	2025-09-03 00:28:24.795	2025-09-03 00:28:24.795
ca92eb74-252e-4d96-b637-5eeb8914ee8b	a48d3f32-f736-46ff-91f2-f835b09b8e8b	PancakeSwap V2	uniswap_v2	0x10ED43C718714eb63d5aA57B78B54704E256024E	0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73	t	0.0025	1800000000.00	t	2025-09-03 00:28:24.796	2025-09-03 00:28:24.796
9aed566f-24e6-441b-878e-a42846fcee95	5644b1e9-989f-473a-b307-ef47c202e0cc	QuickSwap	uniswap_v2	0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff	0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32	f	0.0030	85000000.00	t	2025-09-03 00:28:24.797	2025-09-03 00:28:24.797
\.


--
-- TOC entry 3514 (class 0 OID 16573)
-- Dependencies: 222
-- Data for Name: execution_steps; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.execution_steps (id, execution_id, step_number, step_type, blockchain, transaction_hash, status, token_in, token_out, amount_in, amount_out, dex_exchange, pool_address, gas_used, error_message, started_at, completed_at, created_at) FROM stdin;
\.


--
-- TOC entry 3518 (class 0 OID 16610)
-- Dependencies: 226
-- Data for Name: network_status; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.network_status (id, network_id, block_number, gas_price_gwei, is_syncing, peer_count, response_time_ms, is_healthy, checked_at) FROM stdin;
e3c6b443-0b1a-4379-9b97-a9f2925a7a88	d15ebdf8-42e5-4982-98fe-1083c3ad80c9	23278900	15.5000	f	25	180	t	2025-09-03 00:28:24.803
78bd7774-7845-4123-a8ff-9eb43653379d	a48d3f32-f736-46ff-91f2-f835b09b8e8b	59813100	3.2000	f	18	95	t	2025-09-03 00:28:24.803
28b5cde6-fff3-482e-ad2b-2ece019eed13	5644b1e9-989f-473a-b307-ef47c202e0cc	75981500	35.8000	f	22	120	t	2025-09-03 00:28:24.803
7459afd4-03f6-4cb8-a059-cfa8df1185da	e81979df-d13f-48ae-b2e7-2de185a54d32	145632100	0.1200	f	15	85	t	2025-09-03 00:28:24.803
ed571adc-d034-4da9-9e1b-e26a0b7b294b	c26da9d6-7420-4677-ba70-9480554e0a1a	112458900	0.0800	f	12	75	t	2025-09-03 00:28:24.803
\.


--
-- TOC entry 3510 (class 0 OID 16532)
-- Dependencies: 218
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.subscription_plans (id, name, description, stripe_price_id, price_monthly, features, limits, is_active, created_at) FROM stdin;
1d04eb7d-ecdd-4e1b-8f1c-18c339e8a457	Starter	Perfect for individual traders getting started with arbitrage	\N	29.99	["Real-time opportunities", "Basic strategies", "Email support", "Up to 3 blockchains"]	{"max_configs": 2, "max_blockchains": 3, "api_calls_per_minute": 60, "max_executions_per_day": 10}	t	2025-09-03 00:28:24.784
964ecca7-304c-433a-9e11-d14538f1bc83	Professional	Advanced features for serious arbitrage traders	\N	99.99	["All Starter features", "Advanced strategies", "Priority support", "All blockchains", "Custom notifications"]	{"max_configs": 10, "max_blockchains": 12, "api_calls_per_minute": 300, "max_executions_per_day": 100}	t	2025-09-03 00:28:24.784
c1d8c51a-10d3-4f6e-b9f0-90035ed7477b	Enterprise	Full-featured solution for institutional trading	\N	499.99	["All Professional features", "White-label solution", "24/7 support", "Custom integrations", "Dedicated infrastructure"]	{"max_configs": -1, "max_blockchains": -1, "api_calls_per_minute": 1000, "max_executions_per_day": -1}	t	2025-09-03 00:28:24.784
\.


--
-- TOC entry 3509 (class 0 OID 16523)
-- Dependencies: 217
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.subscriptions (id, tenant_id, stripe_subscription_id, stripe_customer_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3506 (class 0 OID 16495)
-- Dependencies: 214
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.tenants (id, name, slug, domain, branding, subscription_id, settings, status, created_at, updated_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440000	ArbitrageX Demo	demo	demo.arbitragex.pro	\N	\N	\N	ACTIVE	2025-09-03 00:28:24.787	2025-09-03 00:28:24.787
\.


--
-- TOC entry 3517 (class 0 OID 16601)
-- Dependencies: 225
-- Data for Name: trading_pairs; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.trading_pairs (id, dex_protocol_id, token0_address, token1_address, token0_symbol, token1_symbol, pair_address, reserve0, reserve1, price, volume_24h_usd, liquidity_usd, last_updated, created_at) FROM stdin;
2bc5d507-2c0b-40a1-b2f8-61b89c276129	711b8efc-3aa7-490c-b2a4-aebaaf7ba006	0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2	0xA0b86a33E6441c8C7606b9e9F31C2C19b5F0AED	WETH	USDC	0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640	125.000000000000000000	312500.000000000000000000	2500.000000000000000000	45000000.00	8750000.00	2025-09-03 00:28:24.8	2025-09-03 00:28:24.8
bfe4f155-9aa8-4e26-898d-a86ead70e0a0	ca92eb74-252e-4d96-b637-5eeb8914ee8b	0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c	0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d	WBNB	USDC	0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16	2500.000000000000000000	625000.000000000000000000	250.000000000000000000	12000000.00	2100000.00	2025-09-03 00:28:24.802	2025-09-03 00:28:24.802
\.


--
-- TOC entry 3507 (class 0 OID 16504)
-- Dependencies: 215
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: arbitragex
--

COPY public.users (id, tenant_id, email, password_hash, first_name, last_name, role, status, last_login_at, created_at, updated_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440001	550e8400-e29b-41d4-a716-446655440000	admin@arbitragex.pro	$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewvL/Zsd.c6g2ojO	ArbitrageX	Admin	ADMIN	ACTIVE	\N	2025-09-03 00:28:24.789	2025-09-03 00:28:24.789
\.


--
-- TOC entry 3314 (class 2606 OID 16522)
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- TOC entry 3322 (class 2606 OID 16551)
-- Name: arbitrage_configs arbitrage_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_configs
    ADD CONSTRAINT arbitrage_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 3330 (class 2606 OID 16572)
-- Name: arbitrage_executions arbitrage_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_executions
    ADD CONSTRAINT arbitrage_executions_pkey PRIMARY KEY (id);


--
-- TOC entry 3325 (class 2606 OID 16560)
-- Name: arbitrage_opportunities arbitrage_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_opportunities
    ADD CONSTRAINT arbitrage_opportunities_pkey PRIMARY KEY (id);


--
-- TOC entry 3339 (class 2606 OID 16590)
-- Name: blockchain_networks blockchain_networks_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.blockchain_networks
    ADD CONSTRAINT blockchain_networks_pkey PRIMARY KEY (id);


--
-- TOC entry 3342 (class 2606 OID 16600)
-- Name: dex_protocols dex_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.dex_protocols
    ADD CONSTRAINT dex_protocols_pkey PRIMARY KEY (id);


--
-- TOC entry 3335 (class 2606 OID 16581)
-- Name: execution_steps execution_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.execution_steps
    ADD CONSTRAINT execution_steps_pkey PRIMARY KEY (id);


--
-- TOC entry 3349 (class 2606 OID 16617)
-- Name: network_status network_status_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.network_status
    ADD CONSTRAINT network_status_pkey PRIMARY KEY (id);


--
-- TOC entry 3319 (class 2606 OID 16540)
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 3316 (class 2606 OID 16531)
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 3307 (class 2606 OID 16503)
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- TOC entry 3346 (class 2606 OID 16609)
-- Name: trading_pairs trading_pairs_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.trading_pairs
    ADD CONSTRAINT trading_pairs_pkey PRIMARY KEY (id);


--
-- TOC entry 3311 (class 2606 OID 16513)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3312 (class 1259 OID 16621)
-- Name: api_keys_key_hash_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX api_keys_key_hash_key ON public.api_keys USING btree (key_hash);


--
-- TOC entry 3328 (class 1259 OID 16629)
-- Name: arbitrage_executions_opportunity_id_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX arbitrage_executions_opportunity_id_idx ON public.arbitrage_executions USING btree (opportunity_id);


--
-- TOC entry 3331 (class 1259 OID 16627)
-- Name: arbitrage_executions_status_started_at_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX arbitrage_executions_status_started_at_idx ON public.arbitrage_executions USING btree (status, started_at);


--
-- TOC entry 3332 (class 1259 OID 16628)
-- Name: arbitrage_executions_tenant_id_user_id_status_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX arbitrage_executions_tenant_id_user_id_status_idx ON public.arbitrage_executions USING btree (tenant_id, user_id, status);


--
-- TOC entry 3323 (class 1259 OID 16625)
-- Name: arbitrage_opportunities_expires_at_status_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX arbitrage_opportunities_expires_at_status_idx ON public.arbitrage_opportunities USING btree (expires_at, status);


--
-- TOC entry 3326 (class 1259 OID 16626)
-- Name: arbitrage_opportunities_profit_percentage_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX arbitrage_opportunities_profit_percentage_idx ON public.arbitrage_opportunities USING btree (profit_percentage);


--
-- TOC entry 3327 (class 1259 OID 16624)
-- Name: arbitrage_opportunities_strategy_name_blockchain_from_status_id; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX arbitrage_opportunities_strategy_name_blockchain_from_status_id ON public.arbitrage_opportunities USING btree (strategy_name, blockchain_from, status);


--
-- TOC entry 3336 (class 1259 OID 16632)
-- Name: blockchain_networks_chain_id_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX blockchain_networks_chain_id_key ON public.blockchain_networks USING btree (chain_id);


--
-- TOC entry 3337 (class 1259 OID 16631)
-- Name: blockchain_networks_network_id_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX blockchain_networks_network_id_key ON public.blockchain_networks USING btree (network_id);


--
-- TOC entry 3340 (class 1259 OID 16633)
-- Name: dex_protocols_network_id_is_active_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX dex_protocols_network_id_is_active_idx ON public.dex_protocols USING btree (network_id, is_active);


--
-- TOC entry 3333 (class 1259 OID 16630)
-- Name: execution_steps_execution_id_step_number_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX execution_steps_execution_id_step_number_idx ON public.execution_steps USING btree (execution_id, step_number);


--
-- TOC entry 3347 (class 1259 OID 16636)
-- Name: network_status_network_id_checked_at_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX network_status_network_id_checked_at_idx ON public.network_status USING btree (network_id, checked_at);


--
-- TOC entry 3320 (class 1259 OID 16623)
-- Name: subscription_plans_stripe_price_id_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX subscription_plans_stripe_price_id_key ON public.subscription_plans USING btree (stripe_price_id);


--
-- TOC entry 3317 (class 1259 OID 16622)
-- Name: subscriptions_stripe_subscription_id_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX subscriptions_stripe_subscription_id_key ON public.subscriptions USING btree (stripe_subscription_id);


--
-- TOC entry 3305 (class 1259 OID 16619)
-- Name: tenants_domain_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX tenants_domain_key ON public.tenants USING btree (domain);


--
-- TOC entry 3308 (class 1259 OID 16618)
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- TOC entry 3343 (class 1259 OID 16634)
-- Name: trading_pairs_dex_protocol_id_token0_symbol_token1_symbol_idx; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE INDEX trading_pairs_dex_protocol_id_token0_symbol_token1_symbol_idx ON public.trading_pairs USING btree (dex_protocol_id, token0_symbol, token1_symbol);


--
-- TOC entry 3344 (class 1259 OID 16635)
-- Name: trading_pairs_pair_address_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX trading_pairs_pair_address_key ON public.trading_pairs USING btree (pair_address);


--
-- TOC entry 3309 (class 1259 OID 16620)
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: arbitragex
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- TOC entry 3352 (class 2606 OID 16647)
-- Name: api_keys api_keys_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3353 (class 2606 OID 16652)
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3355 (class 2606 OID 16662)
-- Name: arbitrage_configs arbitrage_configs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_configs
    ADD CONSTRAINT arbitrage_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3357 (class 2606 OID 16672)
-- Name: arbitrage_executions arbitrage_executions_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_executions
    ADD CONSTRAINT arbitrage_executions_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.arbitrage_opportunities(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3358 (class 2606 OID 16677)
-- Name: arbitrage_executions arbitrage_executions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_executions
    ADD CONSTRAINT arbitrage_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3359 (class 2606 OID 16682)
-- Name: arbitrage_executions arbitrage_executions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_executions
    ADD CONSTRAINT arbitrage_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3356 (class 2606 OID 16667)
-- Name: arbitrage_opportunities arbitrage_opportunities_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.arbitrage_opportunities
    ADD CONSTRAINT arbitrage_opportunities_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.arbitrage_configs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3361 (class 2606 OID 16692)
-- Name: dex_protocols dex_protocols_network_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.dex_protocols
    ADD CONSTRAINT dex_protocols_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.blockchain_networks(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3360 (class 2606 OID 16687)
-- Name: execution_steps execution_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.execution_steps
    ADD CONSTRAINT execution_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.arbitrage_executions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3363 (class 2606 OID 16702)
-- Name: network_status network_status_network_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.network_status
    ADD CONSTRAINT network_status_network_id_fkey FOREIGN KEY (network_id) REFERENCES public.blockchain_networks(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3354 (class 2606 OID 16657)
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3350 (class 2606 OID 16637)
-- Name: tenants tenants_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3362 (class 2606 OID 16697)
-- Name: trading_pairs trading_pairs_dex_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.trading_pairs
    ADD CONSTRAINT trading_pairs_dex_protocol_id_fkey FOREIGN KEY (dex_protocol_id) REFERENCES public.dex_protocols(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3351 (class 2606 OID 16642)
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arbitragex
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


-- Completed on 2025-09-03 00:29:04 UTC

--
-- PostgreSQL database dump complete
--

