CREATE OR REPLACE FUNCTION set_current_user(username TEXT)
RETURNS void
AS
$$
BEGIN
    PERFORM set_config('app.current_user', username, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;