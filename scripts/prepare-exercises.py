import json

# Read Dataset 
with open("../exercises-dataset/data/exercises.json", encoding="utf-8") as f:
    # Load exercises from JSON file
    exercises = json.load(f)
    # # Filter out exercises that don't have a 'name' or 'instructions' field
    # exercises = [e for e in exercises if 'name' in e]
    # exercises = [i for i in exercises if 'instructions' in i]
    # exercises = [i_s for i_s in exercises if 'instruction_steps' in i_s]
    
    # Select the first exercise from the filtered list
    # exercise = exercises[0]


# Transform Dataset
    for exercise in exercises:
        exercise["instructions"] = exercise["instructions"]["en"]
        exercise["instruction_steps"] = exercise["instruction_steps"]["en"]
    # print(f"Exercise: {exercises[0]['name']}")

# Write Transformed Dataset to File
    with open("assets/data/exercises.json", "w", encoding="utf-8") as f:
        json.dump(exercises, f, indent=4)


