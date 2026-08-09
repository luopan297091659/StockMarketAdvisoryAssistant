# Third-party license texts

Place license texts and upstream NOTICE files required for redistributed third-party components in this directory. Use stable filenames such as `<component>-<version>-LICENSE.txt` and keep entries synchronized with `THIRD_PARTY_NOTICES.md` and the generated SBOM.

The repository now uses third-party package dependencies. Their package distributions contain upstream license metadata, but release packaging still needs an automated step that collects required license and NOTICE texts into this directory. See `THIRD_PARTY_NOTICES.md` for the reviewed direct-dependency summary.
