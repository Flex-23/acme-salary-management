CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"currency_exponent" smallint NOT NULL,
	"usd_per_unit" numeric(18, 8) NOT NULL,
	CONSTRAINT "countries_code_format" CHECK ("countries"."code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "countries_exponent_range" CHECK ("countries"."currency_exponent" between 0 and 4),
	CONSTRAINT "countries_rate_positive" CHECK ("countries"."usd_per_unit" > 0)
);
--> statement-breakpoint
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"job_title" text NOT NULL,
	"department" text NOT NULL,
	"country_code" text NOT NULL,
	"salary_minor" bigint NOT NULL,
	"hire_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_unique" UNIQUE("email"),
	CONSTRAINT "employees_salary_positive" CHECK ("employees"."salary_minor" > 0),
	CONSTRAINT "employees_email_lowercase" CHECK ("employees"."email" = lower("employees"."email"))
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employees_country_idx" ON "employees" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "employees_country_job_title_idx" ON "employees" USING btree ("country_code","job_title");--> statement-breakpoint
CREATE INDEX "employees_department_idx" ON "employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "employees_full_name_trgm_idx" ON "employees" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "employees_email_trgm_idx" ON "employees" USING gin ("email" gin_trgm_ops);