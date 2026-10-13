-- Reference FX rates are illustrative and fixed (as of 2026-01-01). Source of truth: src/server/domain/countries.ts
INSERT INTO "countries" ("code", "name", "currency", "currency_exponent", "usd_per_unit") VALUES
	('US', 'United States', 'USD', 2, 1),
	('GB', 'United Kingdom', 'GBP', 2, 1.27),
	('IN', 'India', 'INR', 2, 0.012),
	('DE', 'Germany', 'EUR', 2, 1.08),
	('FR', 'France', 'EUR', 2, 1.08),
	('CA', 'Canada', 'CAD', 2, 0.73),
	('AU', 'Australia', 'AUD', 2, 0.65),
	('SG', 'Singapore', 'SGD', 2, 0.74),
	('AE', 'United Arab Emirates', 'AED', 2, 0.2723),
	('JP', 'Japan', 'JPY', 0, 0.0067);
