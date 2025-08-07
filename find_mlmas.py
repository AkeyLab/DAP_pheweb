#!/scratch/rbierma1/DAP_pheweb_20250415/pheweb_env/bin/python
import pandas as pd
import pathlib

if __name__ == '__main__':

    # Read in the metadata table
    df = pd.read_table("pheweb_included_phenotypes_N-313_metadata.tsv")

    # Find the .mlma files
    mlma_met_path = pathlib.Path("/scratch/vsohrab/dap_precision2024_metabolite_gwas/association")
    mlma_blood_path = pathlib.Path("/scratch/vsohrab/dap_precision2024_blood_gwas/association")
    mlma_survey_path = pathlib.Path("/scratch/vsohrab/dap_gwas_geneticset2023_datarelease2022_nextflow/association")
    mlma_paths = {"metabolite":mlma_met_path, "blood":mlma_blood_path, "survey":mlma_survey_path}

    mlma_info = {
        "category": [],
        "full_path": [],
        "phenotype": [],
    }

    for category,cat_p in mlma_paths.items():
        for mlma_p in cat_p.glob("*.mlma"):
            mlma_info["category"].append(category)
            mlma_info["full_path"].append(str(mlma_p))
            mlma_info["phenotype"].append(mlma_p.name.split("_N-")[0])

    mlma_df = pd.DataFrame(mlma_info)

    # Add the .mlma files to the metadata table based on "phenotype"
    m_df = df.merge(mlma_df)

    m_df.to_csv("mlma_paths_with_metadata.csv", index=None)





