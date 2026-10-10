"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidLogin } from "@/data/github/fetchCityInput";
import { cue } from "@/ui/sound/sound";

/** Asks for a GitHub username and opens its city. */
export function UsernameForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className="username-form"
      onSubmit={(e) => {
        e.preventDefault();
        const value = login.trim().replace(/^@/, "");
        if (!isValidLogin(value)) {
          setInvalid(true);
          cue("error");
          return;
        }
        router.push(`/u/${value}`);
      }}
    >
      <label htmlFor="login">GitHub username</label>
      <div className="username-row">
        <input
          id="login"
          name="login"
          value={login}
          onChange={(e) => {
            setLogin(e.target.value);
            setInvalid(false);
          }}
          className="ui-field"
          placeholder="octocat"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? "login-error" : undefined}
          data-cuelume-type
          data-cuelume-emphasis="subtle"
        />
        <button type="submit" className="ui-button ui-button--gold" data-cuelume-tap>
          Open city
        </button>
      </div>
      {invalid && (
        <p id="login-error" role="alert">
          Usernames use letters, numbers and single hyphens, up to 39 characters.
        </p>
      )}
    </form>
  );
}
