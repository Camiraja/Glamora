CREATE FUNCTION "reject_wallet_transaction_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Wallet ledger entries are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "WalletTransaction_immutable_trigger"
BEFORE UPDATE OR DELETE ON "WalletTransaction"
FOR EACH ROW
EXECUTE FUNCTION "reject_wallet_transaction_mutation"();